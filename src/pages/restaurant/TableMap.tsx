// customer-portal/src/pages/restaurant/TableMap.tsx
/* eslint-disable react-hooks/refs -- Refs de pan/pinch-zoom: solo se leen o
   mutan en manejadores de eventos/efectos, nunca durante el render (el uso
   correcto para este tipo de estado mutable). Regla aún experimental que
   no sigue esas closures y da un falso positivo. */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import {
  Pencil,
  Trash2,
  Users,
  X,
  Receipt,
  UtensilsCrossed,
  RectangleHorizontal,
  Circle,
  ZoomIn,
  ZoomOut,
  Locate,
  XCircle,
  Printer,
} from "lucide-react";
import {
  tablesApi,
  tableSessionsApi,
  ordersApi,
  isConflictError,
  type RestaurantTable,
  type TableShape,
  type Order,
} from "../../api";
import { useRestaurantInstance } from "../../hooks/useRestaurantInstance";
import { useInstanceEvents } from "../../hooks/useInstanceEvents";
import ConfirmDialog from "../../components/ConfirmDialog";
import Modal from "../../components/Modal";
import { Spinner } from "../../components/icons";
import { getErrorMessage } from "../../utils/errors";
import { money, toLocalTimeString } from "../../utils/format";
import { getInputClass } from "../../utils/inputClass";
import { TABLE_STATUS_LABEL, TABLE_STATUS_CELL } from "../../utils/tableStatus";
import {
  STATUS_LABEL,
  STATUS_STYLES,
  NEXT_ACTION,
  COMPLETED_LABEL,
  COMPLETED_STYLE,
} from "../../utils/orderStatus";
import {
  OrderCardHeader,
  OrderItemsList,
  OrderNotesBox,
  OrderAdvanceButton,
  CancelOrderConfirmDialog,
} from "../../components/OrderTicketParts";
import { printOrderTicket } from "../../utils/printTicket";

// ─── Config ───────────────────────────────────────────────────────────────────

// Red de seguridad si el stream SSE se corta; se pausa durante la edición
// para no pisar el borrador local con datos del servidor.
const POLL_INTERVAL_MS = 30000;
const MIN_ROWS = 6;
const MIN_COLS = 8;
const GRID_PADDING = 2;
const CELL_SIZE = 84; // px — tamaño de una celda 1×1 del salón, sin zoom
const CELL_GAP = 10;
const MIN_SCALE = 0.4;
const MAX_SCALE = 2.5;
const ZOOM_STEP = 1.25;
const PAN_CLICK_THRESHOLD = 4; // px de movimiento a partir de los cuales un gesto deja de considerarse un "clic"

type FormState = {
  number: string;
  name: string;
  seats: string;
  shape: TableShape;
  width: string;
  height: string;
};

const EMPTY_FORM: FormState = {
  number: "",
  name: "",
  seats: "2",
  shape: "RECTANGLE",
  width: "1",
  height: "1",
};

function tableToForm(t: RestaurantTable): FormState {
  return {
    number: String(t.number),
    name: t.name,
    seats: String(t.seats),
    shape: t.shape,
    width: String(t.width),
    height: String(t.height),
  };
}

const SHAPE_OPTIONS: {
  value: TableShape;
  label: string;
  icon: typeof Circle;
}[] = [
  { value: "RECTANGLE", label: "Cuadrada", icon: RectangleHorizontal },
  { value: "ROUND", label: "Redonda", icon: Circle },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Campos "de forma" de una mesa que el backend acepta tanto al crear como
 *  al actualizar (todo salvo posición, que cada llamada gestiona aparte). */
function tablePayload(t: RestaurantTable) {
  return {
    number: t.number,
    name: t.name,
    seats: t.seats,
    shape: t.shape,
    posRow: t.posRow,
    posCol: t.posCol,
    width: t.width,
    height: t.height,
  };
}

/** Tarjeta de un pedido en curso dentro del panel de detalle de la mesa:
 *  mismas piezas y acciones que en Gestión de pedidos (avanzar, editar,
 *  cancelar, imprimir), para no tener que salir del mapa para tocar algo. */
function SessionOrderCard({
  order,
  busy,
  onCancel,
  onEdit,
  onPrint,
  onAdvance,
}: {
  order: Order;
  busy: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onPrint: () => void;
  onAdvance: () => void;
}) {
  const nextAction = NEXT_ACTION[order.status];
  const isOrderClosed = ["DELIVERED", "CANCELLED"].includes(order.status);
  const showCompleted =
    order.status === "DELIVERED" && order.tableSessionClosedAt !== null;

  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3">
      <OrderCardHeader
        order={order}
        meta={
          <>
            #{order.id} · {order.waiterName} ·{" "}
            {toLocalTimeString(order.createdAt)}
          </>
        }
        badge={showCompleted ? COMPLETED_LABEL : STATUS_LABEL[order.status]}
        badgeClassName={
          showCompleted ? COMPLETED_STYLE : STATUS_STYLES[order.status]
        }
      />
      <div className="border-t border-zinc-200 dark:border-zinc-800 mt-2 pt-2">
        <OrderItemsList items={order.items} />
      </div>
      {order.notes && (
        <div className="mt-2">
          <OrderNotesBox notes={order.notes} />
        </div>
      )}
      {/* Negativo (izq.) → auxiliar (centro) → positivo (der.) */}
      <div className="flex items-center justify-between gap-1 mt-2">
        {!isOrderClosed ? (
          <button
            disabled={busy}
            onClick={onCancel}
            title="Cancelar pedido"
            aria-label="Cancelar pedido"
            className="p-2 text-zinc-500 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-400/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" strokeWidth={1.8} />
          </button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          {!isOrderClosed && (
            <button
              onClick={onEdit}
              title="Editar pedido"
              aria-label="Editar pedido"
              className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.8} />
            </button>
          )}
          <button
            onClick={onPrint}
            title="Imprimir ticket"
            aria-label="Imprimir ticket"
            className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" strokeWidth={1.8} />
          </button>
        </div>
        <OrderAdvanceButton
          action={nextAction}
          busy={busy}
          onClick={onAdvance}
        />
      </div>
    </div>
  );
}

function pointerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ── Vista guardada (zoom + posición) ────────────────────────────────────────
// Se recuerda por restaurante para no tener que centrar y hacer zoom de
// nuevo cada vez que se entra al mapa.

const VIEW_STORAGE_PREFIX = "restaurant-table-map-view:";

function loadSavedView(
  instanceId: number,
): { scale: number; x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_PREFIX + instanceId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{
      scale: number;
      x: number;
      y: number;
    }>;
    if (
      typeof parsed.scale === "number" &&
      typeof parsed.x === "number" &&
      typeof parsed.y === "number"
    ) {
      return { scale: parsed.scale, x: parsed.x, y: parsed.y };
    }
  } catch {
    // localStorage no disponible (modo privado, cuota llena…) o dato
    // corrupto: no es crítico, simplemente se ignora y se centra por defecto.
  }
  return null;
}

function saveView(
  instanceId: number,
  view: { scale: number; x: number; y: number },
) {
  try {
    localStorage.setItem(
      VIEW_STORAGE_PREFIX + instanceId,
      JSON.stringify(view),
    );
  } catch {
    // idem: no es crítico si no se puede guardar
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TableMap() {
  const navigate = useNavigate();
  const instance = useRestaurantInstance();
  const id = instance?.id ?? 0;
  const { access } = useAuth();
  const restaurantName = access?.company || access?.name;
  const slug = instance?.slug ?? "";
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [extraRows, setExtraRows] = useState(0);
  const [extraCols, setExtraCols] = useState(0);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Borrador local de la edición: se copia de `tables` al entrar en modo
  // edición y solo se envía al backend al pulsar "Guardar" (o se descarta
  // por completo al pulsar "Cancelar"). Mientras tanto nada se persiste.
  const [draftTables, setDraftTables] = useState<RestaurantTable[] | null>(
    null,
  );
  const [originalTables, setOriginalTables] = useState<
    RestaurantTable[] | null
  >(null);
  const nextTempId = useRef(-1);

  const [selected, setSelected] = useState<RestaurantTable | null>(null);
  const [editingTable, setEditingTable] = useState<
    RestaurantTable | "new" | null
  >(null);
  const [newTablePosition, setNewTablePosition] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<RestaurantTable | null>(
    null,
  );

  // ── Zoom / pan ────────────────────────────────────────────────────────────
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const centeredOnce = useRef(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartDist = useRef<number | null>(null);
  const pinchStartScale = useRef(1);
  // Ref (no state) para no depender del timing de React: al arrastrar/pellizcar
  // se marca a true para que el "clic" que el navegador dispara justo después
  // del soltar no abra ni cree una mesa sin querer.
  const suppressClickRef = useRef(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const {
    data: tables = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["tables", id],
    queryFn: () => tablesApi.list(id),
    enabled: !!id,
    refetchInterval: editMode ? false : POLL_INTERVAL_MS,
  });
  const error = queryError
    ? getErrorMessage(queryError, "Error al cargar el mapa de mesas")
    : null;

  // Qué se dibuja: el borrador mientras se edita, los datos reales si no.
  const displayTables = editMode && draftTables ? draftTables : tables;

  // Versión "viva" de la mesa seleccionada (por id), para que el panel de
  // detalle refleje cambios de estado que lleguen por el sondeo mientras
  // está abierto, en vez de quedarse con la foto fija del momento del clic.
  const selectedLive = selected
    ? (tables.find((t) => t.id === selected.id) ?? selected)
    : null;

  // Avisos en tiempo real (SSE): en cuanto un pedido o una mesa cambian
  // (desde este dispositivo o desde otro), se refresca al momento en vez de
  // esperar a POLL_INTERVAL_MS. Se sigue respetando la pausa en editMode.
  useInstanceEvents(editMode ? undefined : id, [
    ["tables", id],
    ["table-session", selectedLive?.tableSessionId],
  ]);

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["table-session", selectedLive?.tableSessionId],
    queryFn: () => tableSessionsApi.get(selectedLive!.tableSessionId!),
    enabled: !!selectedLive?.tableSessionId && selectedLive.status !== "LIBRE",
  });

  // Mientras se está cargando la sesión de la mesa aún no sabemos si hay un
  // pedido activo al que sumar: se deshabilita un instante en vez de
  // arriesgarse a crear un ticket aparte por error si se pulsa muy rápido.
  const stillResolvingSession =
    !!selectedLive && selectedLive.status !== "LIBRE" && sessionLoading;
  const activeSessionOrder = session
    ? [...session.orders]
        .filter((o) => o.status !== "CANCELLED")
        .sort((a, b) => b.id - a.id)[0]
    : undefined;

  // ── Dimensiones de la rejilla ────────────────────────────────────────────

  const { rows, cols } = useMemo(() => {
    const maxRow = displayTables.length
      ? Math.max(...displayTables.map((t) => t.posRow + t.height))
      : 0;
    const maxCol = displayTables.length
      ? Math.max(...displayTables.map((t) => t.posCol + t.width))
      : 0;
    return {
      rows: Math.max(MIN_ROWS, maxRow + GRID_PADDING) + extraRows,
      cols: Math.max(MIN_COLS, maxCol + GRID_PADDING) + extraCols,
    };
  }, [displayTables, extraRows, extraCols]);

  const gridWidthPx = cols * CELL_SIZE + (cols - 1) * CELL_GAP;
  const gridHeightPx = rows * CELL_SIZE + (rows - 1) * CELL_GAP;

  // Celda → id de la mesa que la ocupa, para saber qué celdas están libres
  // y detectar colisiones al arrastrar/crear/redimensionar.
  const occupancy = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of displayTables) {
      for (let r = t.posRow; r < t.posRow + t.height; r++) {
        for (let c = t.posCol; c < t.posCol + t.width; c++) {
          map.set(`${r}:${c}`, t.id);
        }
      }
    }
    return map;
  }, [displayTables]);

  function areaIsFree(
    row: number,
    col: number,
    width: number,
    height: number,
    ignoreId?: number,
  ) {
    if (row < 0 || col < 0) return false;
    for (let r = row; r < row + height; r++) {
      for (let c = col; c < col + width; c++) {
        const occupant = occupancy.get(`${r}:${c}`);
        if (occupant !== undefined && occupant !== ignoreId) return false;
      }
    }
    return true;
  }

  function isNumberTaken(number: number, ignoreId?: number) {
    return displayTables.some((t) => t.number === number && t.id !== ignoreId);
  }

  /** Comprueba número libre + hueco libre para crear/editar una mesa;
   *  devuelve el mensaje de error a mostrar, o null si todo es válido. */
  function validatePlacement(
    number: number,
    row: number,
    col: number,
    width: number,
    height: number,
    overlapMessage: string,
    ignoreId?: number,
  ): string | null {
    if (isNumberTaken(number, ignoreId)) {
      return `Ya hay una mesa con el número ${number}`;
    }
    if (!areaIsFree(row, col, width, height, ignoreId)) {
      return overlapMessage;
    }
    return null;
  }

  // ── Centrado inicial + botón "centrar" ───────────────────────────────────

  const centerView = useCallback(
    (targetScale = 1) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      setScale(targetScale);
      setPan({
        x: (viewport.clientWidth - gridWidthPx * targetScale) / 2,
        y: (viewport.clientHeight - gridHeightPx * targetScale) / 2,
      });
    },
    [gridWidthPx, gridHeightPx],
  );

  const applyInitialView = useCallback(() => {
    const saved = id ? loadSavedView(id) : null;
    if (saved) {
      setScale(clamp(saved.scale, MIN_SCALE, MAX_SCALE));
      setPan({ x: saved.x, y: saved.y });
    } else {
      centerView();
    }
  }, [id, centerView]);

  useLayoutEffect(() => {
    if (!loading && !centeredOnce.current && viewportRef.current) {
      applyInitialView();
      centeredOnce.current = true;
    }
  }, [loading, applyInitialView]);

  // Recuerda el zoom/posición actuales para la próxima visita a esta página.
  useEffect(() => {
    if (!centeredOnce.current || !id) return;
    saveView(id, { scale, x: pan.x, y: pan.y });
  }, [id, scale, pan]);

  function zoomBy(factor: number, center?: { x: number; y: number }) {
    const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    if (next === scale) return;
    const ratio = next / scale;
    const viewport = viewportRef.current;
    const cx = center?.x ?? (viewport ? viewport.clientWidth / 2 : 0);
    const cy = center?.y ?? (viewport ? viewport.clientHeight / 2 : 0);
    // Mantiene fijo, en espacio de contenido, el punto sobre el que se hace
    // zoom (el cursor, o el centro del visor si no se indica ninguno).
    setPan((prev) => ({
      x: cx - (cx - prev.x) * ratio,
      y: cy - (cy - prev.y) * ratio,
    }));
    setScale(next);
  }

  // Paso de desplazamiento por pulsación de flecha, en px de pantalla.
  const KEY_PAN_STEP = 60;

  function handleViewportKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        setPan((prev) => ({ ...prev, y: prev.y + KEY_PAN_STEP }));
        break;
      case "ArrowDown":
        e.preventDefault();
        setPan((prev) => ({ ...prev, y: prev.y - KEY_PAN_STEP }));
        break;
      case "ArrowLeft":
        e.preventDefault();
        setPan((prev) => ({ ...prev, x: prev.x + KEY_PAN_STEP }));
        break;
      case "ArrowRight":
        e.preventDefault();
        setPan((prev) => ({ ...prev, x: prev.x - KEY_PAN_STEP }));
        break;
      case "+":
      case "=":
        e.preventDefault();
        zoomBy(ZOOM_STEP);
        break;
      case "-":
      case "_":
        e.preventDefault();
        zoomBy(1 / ZOOM_STEP);
        break;
      case "0":
        e.preventDefault();
        centerView();
        break;
      default:
        break;
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  // Arrastre (ratón o un dedo) y pellizco (dos dedos) para desplazarse y
  // hacer zoom. Si el gesto empieza sobre una mesa en modo edición, se deja
  // pasar sin más: de eso se encarga el drag & drop nativo (ver más abajo),
  // que además es el que permite reposicionar la mesa en la rejilla.
  function handleViewportPointerDown(e: React.PointerEvent) {
    const targetEl = e.target as HTMLElement;
    if (editMode && targetEl.closest("[data-table-cell]")) return;

    suppressClickRef.current = false;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2) {
      const pts = Array.from(activePointers.current.values());
      pinchStartDist.current = pointerDistance(pts[0], pts[1]);
      pinchStartScale.current = scale;
      isPanning.current = false;
    } else if (activePointers.current.size === 1) {
      isPanning.current = true;
      panStart.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  }

  function handleViewportPointerMove(e: React.PointerEvent) {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 2 && pinchStartDist.current) {
      const pts = Array.from(activePointers.current.values());
      const dist = pointerDistance(pts[0], pts[1]);
      const next = clamp(
        pinchStartScale.current * (dist / pinchStartDist.current),
        MIN_SCALE,
        MAX_SCALE,
      );
      setScale(next);
      return;
    }

    if (isPanning.current && activePointers.current.size === 1) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      if (
        Math.abs(dx) > PAN_CLICK_THRESHOLD ||
        Math.abs(dy) > PAN_CLICK_THRESHOLD
      ) {
        suppressClickRef.current = true;
      }
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
  }

  function handleViewportPointerUp(e: React.PointerEvent) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchStartDist.current = null;
    if (activePointers.current.size === 0) isPanning.current = false;
  }

  // ── Mutations (fuera del modo edición: acciones inmediatas sobre pedidos) ──

  // Diálogo de confirmación antes de cerrar y cobrar (una mesa se cierra
  // fácilmente sin querer si no hay confirmación de por medio).
  const [closeConfirm, setCloseConfirm] = useState<RestaurantTable | null>(
    null,
  );
  const [cancelOrderConfirm, setCancelOrderConfirm] = useState<Order | null>(
    null,
  );

  const closeSessionMutation = useMutation({
    mutationFn: (sessionId: number) => tableSessionsApi.close(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables", id] });
      void queryClient.invalidateQueries({ queryKey: ["orders", id] });
      setSelected(null);
      setCloseConfirm(null);
    },
    onError: (e: unknown) =>
      alert(getErrorMessage(e, "Error al cerrar la mesa")),
  });

  // Avanzar de estado o cancelar un pedido concreto desde la modal de la
  // mesa: misma acción, solo cambia a qué estado se manda.
  const orderStatusMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
      expectedUpdatedAt,
    }: {
      orderId: number;
      status: Order["status"];
      expectedUpdatedAt?: string;
    }) => ordersApi.updateStatus(orderId, status, expectedUpdatedAt),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables", id] });
      void queryClient.invalidateQueries({ queryKey: ["orders", id] });
      void queryClient.invalidateQueries({
        queryKey: ["table-session", selectedLive?.tableSessionId],
      });
      setCancelOrderConfirm(null);
    },
    onError: (e: unknown) => {
      if (isConflictError(e)) {
        void queryClient.invalidateQueries({
          queryKey: ["table-session", selectedLive?.tableSessionId],
        });
      }
      alert(getErrorMessage(e, "Error al actualizar el pedido"));
    },
  });

  // Guarda de golpe todo el borrador: borra las mesas quitadas, crea las
  // nuevas y actualiza las que cambiaron. Si algo falla a mitad, se
  // recarga el mapa desde el servidor y se reconstruye el borrador sobre
  // esa base real, para no reintentar operaciones que ya se aplicaron.
  const saveMutation = useMutation({
    mutationFn: async () => {
      const original = originalTables ?? [];
      const draft = draftTables ?? [];
      const deletedIds = original
        .filter((o) => !draft.some((d) => d.id === o.id))
        .map((o) => o.id);
      const newTables = draft.filter((t) => t.id < 0);
      const existingTables = draft.filter((t) => t.id > 0);

      for (const tid of deletedIds) {
        await tablesApi.remove(tid);
      }
      for (const t of newTables) {
        await tablesApi.create(id, tablePayload(t));
      }
      for (const t of existingTables) {
        const orig = original.find((o) => o.id === t.id);
        if (!orig) continue;
        const changed =
          orig.number !== t.number ||
          orig.name !== t.name ||
          orig.seats !== t.seats ||
          orig.shape !== t.shape ||
          orig.posRow !== t.posRow ||
          orig.posCol !== t.posCol ||
          orig.width !== t.width ||
          orig.height !== t.height;
        if (!changed) continue;
        await tablesApi.update(t.id, {
          ...tablePayload(t),
          expectedUpdatedAt: orig.updatedAt,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables", id] });
      setDraftTables(null);
      setOriginalTables(null);
      setEditMode(false);
      setExtraRows(0);
      setExtraCols(0);
      closeEditor();
    },
    onError: async (e: unknown) => {
      alert(
        getErrorMessage(
          e,
          "Hubo un error guardando el mapa. Se han conservado los cambios que sí se aplicaron; revisa el mapa e inténtalo de nuevo.",
        ),
      );
      const res = await refetch();
      const fresh = res.data ?? [];
      setOriginalTables(fresh);
      setDraftTables(fresh.map((t) => ({ ...t })));
    },
  });

  // ── Entrar / salir del modo edición ──────────────────────────────────────

  function enterEditMode() {
    setOriginalTables(tables);
    setDraftTables(tables.map((t) => ({ ...t })));
    setEditMode(true);
    setSelected(null);
  }

  function cancelEdit() {
    setDraftTables(null);
    setOriginalTables(null);
    setEditMode(false);
    setExtraRows(0);
    setExtraCols(0);
    closeEditor();
  }

  // ── Editor de mesa (crear/editar dentro del borrador) ────────────────────

  function nextFreeNumber(): string {
    const used = new Set(displayTables.map((t) => t.number));
    let n = 1;
    while (used.has(n)) n++;
    return String(n);
  }

  function openCreateEditor(row: number, col: number) {
    setForm({ ...EMPTY_FORM, number: nextFreeNumber() });
    setNewTablePosition({ row, col });
    setFormError(null);
    setEditingTable("new");
  }

  function openEditEditor(table: RestaurantTable) {
    setForm(tableToForm(table));
    setFormError(null);
    setEditingTable(table);
  }

  function closeEditor() {
    setEditingTable(null);
    setNewTablePosition(null);
    setFormError(null);
  }

  function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    const number = Number(form.number);
    const seats = Number(form.seats);
    const width = Number(form.width);
    const height = Number(form.height);

    if (!Number.isInteger(number) || number <= 0) {
      setFormError("El número de mesa debe ser un entero positivo");
      return;
    }
    if (!Number.isInteger(seats) || seats <= 0) {
      setFormError("El número de comensales debe ser un entero positivo");
      return;
    }
    if (
      !Number.isInteger(width) ||
      width <= 0 ||
      !Number.isInteger(height) ||
      height <= 0
    ) {
      setFormError("El ancho y el alto deben ser enteros positivos");
      return;
    }

    if (editingTable === "new") {
      if (!newTablePosition) return;
      const placementError = validatePlacement(
        number,
        newTablePosition.row,
        newTablePosition.col,
        width,
        height,
        "Esas dimensiones no caben ahí: se solapan con otra mesa",
      );
      if (placementError) {
        setFormError(placementError);
        return;
      }
      const newTable: RestaurantTable = {
        id: nextTempId.current--,
        instanceId: id,
        number,
        name: form.name.trim(),
        seats,
        shape: form.shape,
        posRow: newTablePosition.row,
        posCol: newTablePosition.col,
        width,
        height,
        // Es un borrador local que todavía no existe en el servidor (id
        // negativo, ver nextTempId): estas fechas son solo un relleno de
        // tipo, se descartan al guardar (tablesApi.create no las envía) y
        // el backend les asigna las suyas propias.
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "LIBRE",
        tableSessionId: null,
        waiterName: "",
        openOrdersCount: 0,
        total: 0,
      };
      setDraftTables((prev) => [...(prev ?? []), newTable]);
      closeEditor();
    } else if (editingTable) {
      const placementError = validatePlacement(
        number,
        editingTable.posRow,
        editingTable.posCol,
        width,
        height,
        "El nuevo tamaño no cabe aquí: se solapa con otra mesa",
        editingTable.id,
      );
      if (placementError) {
        setFormError(placementError);
        return;
      }
      setDraftTables((prev) =>
        (prev ?? []).map((t) =>
          t.id === editingTable.id
            ? {
                ...t,
                number,
                name: form.name.trim(),
                seats,
                shape: form.shape,
                width,
                height,
              }
            : t,
        ),
      );
      closeEditor();
    }
  }

  function confirmDeleteDraftTable() {
    if (!deleteConfirm) return;
    setDraftTables((prev) =>
      (prev ?? []).filter((t) => t.id !== deleteConfirm.id),
    );
    setDeleteConfirm(null);
    setSelected(null);
  }

  // ── Drag & drop nativo (reposicionar mesas dentro de la rejilla) ─────────

  function handleDrop(row: number, col: number) {
    if (draggingId === null) return;
    const table = displayTables.find((t) => t.id === draggingId);
    setDraggingId(null);
    if (!table) return;
    if (table.posRow === row && table.posCol === col) return;
    if (!areaIsFree(row, col, table.width, table.height, table.id)) return;
    setDraftTables((prev) =>
      (prev ?? []).map((t) =>
        t.id === table.id ? { ...t, posRow: row, posCol: col } : t,
      ),
    );
  }

  // ── Clics (con protección frente al arrastre del mapa) ───────────────────

  function handleEmptyCellClick(row: number, col: number) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (editMode) openCreateEditor(row, col);
  }

  function handleTableClick(table: RestaurantTable) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (editMode) openEditEditor(table);
    else setSelected(table);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="px-6 lg:px-8 py-6 w-full">
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-5 py-4 text-sm text-red-700 dark:text-red-400">
          {error}
          <button
            onClick={() => void refetch()}
            className="ml-4 underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const stats = {
    libre: tables.filter((t) => t.status === "LIBRE").length,
    ocupadas: tables.filter((t) => t.status !== "LIBRE").length,
  };
  const viewportHeightClass = "h-[65vh] min-h-[420px] max-h-[720px]";

  return (
    <div className="px-6 lg:px-8 py-6 w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Mapa de mesas
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {tables.length} mesa{tables.length !== 1 ? "s" : ""} · {stats.libre}{" "}
            libre{stats.libre !== 1 ? "s" : ""} · {stats.ocupadas} ocupada
            {stats.ocupadas !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          {editMode && (
            <div className="flex gap-2">
              <button
                onClick={() => setExtraCols((n) => n + 1)}
                disabled={saveMutation.isPending}
                className="flex-1 sm:flex-none px-3 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors disabled:opacity-50"
              >
                + Columna
              </button>
              <button
                onClick={() => setExtraRows((n) => n + 1)}
                disabled={saveMutation.isPending}
                className="flex-1 sm:flex-none px-3 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors disabled:opacity-50"
              >
                + Fila
              </button>
            </div>
          )}
          <div className="flex gap-2">
            {editMode ? (
              <>
                <button
                  onClick={cancelEdit}
                  disabled={saveMutation.isPending}
                  className="flex-1 sm:flex-none px-5 py-3 text-sm font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors disabled:opacity-50"
                >
                  {saveMutation.isPending && <Spinner />}
                  Guardar
                </button>
              </>
            ) : (
              <button
                onClick={enterEditMode}
                className="px-5 py-3 text-sm font-bold rounded-xl transition-colors bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Editar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 text-xs text-zinc-500">
        {(
          Object.keys(TABLE_STATUS_LABEL) as (keyof typeof TABLE_STATUS_LABEL)[]
        ).map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span
              className={`w-3 h-3 rounded-full border ${TABLE_STATUS_CELL[status]}`}
            />
            {TABLE_STATUS_LABEL[status]}
          </span>
        ))}
      </div>

      <p className="text-xs text-zinc-500 mb-4">
        {editMode
          ? "Arrastra una mesa para moverla, haz clic sobre ella para editarla o pulsa una celda vacía para añadir una mesa nueva. "
          : ""}
        Desliza para moverte por el salón, y pellizca (o usa los controles) para
        hacer zoom.
      </p>

      {loading ? (
        <div
          className={`${viewportHeightClass} bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl animate-pulse`}
        />
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 md:p-3">
          <div
            ref={viewportRef}
            className={`relative w-full ${viewportHeightClass} overflow-hidden rounded-xl bg-zinc-50 dark:bg-zinc-950/40 cursor-grab active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              saveMutation.isPending ? "opacity-60 pointer-events-none" : ""
            }`}
            style={{ touchAction: "none" }}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
            onPointerCancel={handleViewportPointerUp}
            onPointerLeave={handleViewportPointerUp}
            onWheel={handleWheel}
            // Operable por teclado: flechas para moverse, +/- para el zoom,
            // 0 para recentrar. El arrastre con el puntero ya cubría el
            // resto, pero antes no había forma de mover ni hacer zoom sin
            // ratón/dedo.
            tabIndex={0}
            role="group"
            aria-label="Mapa de mesas. Usa las flechas para desplazarte, + y - para el zoom, 0 para centrar. Tabula para pasar de una mesa a otra."
            onKeyDown={handleViewportKeyDown}
          >
            <div
              className="absolute top-0 left-0"
              style={{
                width: gridWidthPx,
                height: gridHeightPx,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: "0 0",
              }}
            >
              <div
                className="relative grid"
                style={{
                  gridTemplateColumns: `repeat(${cols}, ${CELL_SIZE}px)`,
                  gridTemplateRows: `repeat(${rows}, ${CELL_SIZE}px)`,
                  gap: `${CELL_GAP}px`,
                }}
              >
                {/* Celdas vacías: guía visual + destino de clic/soltar */}
                {Array.from({ length: rows }).flatMap((_, r) =>
                  Array.from({ length: cols }).map((_, c) => {
                    if (occupancy.has(`${r}:${c}`)) return null;
                    return (
                      <div
                        key={`empty-${r}-${c}`}
                        style={{ gridRow: r + 1, gridColumn: c + 1 }}
                        onClick={() => handleEmptyCellClick(r, c)}
                        onDragOver={(e) => editMode && e.preventDefault()}
                        onDrop={() => editMode && handleDrop(r, c)}
                        // Solo interactúa de verdad en modo edición (añadir
                        // mesa), así que solo entonces entra en el orden de
                        // tabulación.
                        role={editMode ? "button" : undefined}
                        tabIndex={editMode ? 0 : -1}
                        aria-label={
                          editMode
                            ? `Añadir mesa en la fila ${r + 1}, columna ${c + 1}`
                            : undefined
                        }
                        onKeyDown={(e) => {
                          if (
                            editMode &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            handleEmptyCellClick(r, c);
                          }
                        }}
                        className={`rounded-xl border border-dashed transition-colors ${
                          editMode
                            ? "border-zinc-300 dark:border-zinc-700 hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-500/5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            : "border-zinc-100 dark:border-zinc-800/60"
                        }`}
                      />
                    );
                  }),
                )}

                {/* Mesas */}
                {displayTables.map((table) => (
                  <div
                    key={table.id}
                    data-table-cell
                    draggable={editMode}
                    onDragStart={(e) => {
                      // Firefox exige setData para permitir que el drag arranque.
                      e.dataTransfer.setData("text/plain", String(table.id));
                      setDraggingId(table.id);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                    onDragOver={(e) => editMode && e.preventDefault()}
                    onClick={() => handleTableClick(table)}
                    // Operable por teclado (antes solo con clic/toque):
                    // Tab llega a cada mesa y Enter/Espacio la abren, igual
                    // que un clic.
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleTableClick(table);
                      }
                    }}
                    style={{
                      gridRow: `${table.posRow + 1} / span ${table.height}`,
                      gridColumn: `${table.posCol + 1} / span ${table.width}`,
                    }}
                    className={`relative flex flex-col items-center justify-center gap-1 border-2 p-2 transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                      table.shape === "ROUND" ? "rounded-full" : "rounded-xl"
                    } ${TABLE_STATUS_CELL[table.status]} ${
                      draggingId === table.id ? "opacity-40" : ""
                    } ${
                      editMode
                        ? "hover:ring-2 hover:ring-teal-400"
                        : "hover:brightness-95 dark:hover:brightness-125"
                    }`}
                    title={`Mesa ${table.number}${table.name ? ` · ${table.name}` : ""}`}
                    aria-label={`Mesa ${table.number}${table.name ? ` · ${table.name}` : ""} · ${table.seats} comensales · ${TABLE_STATUS_LABEL[table.status]}`}
                  >
                    <span className="text-lg font-bold leading-none">
                      {table.number}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium opacity-80">
                      <Users className="w-3 h-3" strokeWidth={2} />
                      {table.seats}
                    </span>
                    {editMode && (
                      <Pencil
                        className="absolute top-1.5 right-1.5 w-3 h-3 opacity-50"
                        strokeWidth={2}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Controles de zoom / centrado, fijos sobre el visor */}
            <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => zoomBy(ZOOM_STEP)}
                className="w-9 h-9 flex items-center justify-center bg-white/90 dark:bg-zinc-800/90 backdrop-blur border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                title="Acercar"
                aria-label="Acercar"
              >
                <ZoomIn className="w-4 h-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => zoomBy(1 / ZOOM_STEP)}
                className="w-9 h-9 flex items-center justify-center bg-white/90 dark:bg-zinc-800/90 backdrop-blur border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                title="Alejar"
                aria-label="Alejar"
              >
                <ZoomOut className="w-4 h-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => centerView(1)}
                className="w-9 h-9 flex items-center justify-center bg-white/90 dark:bg-zinc-800/90 backdrop-blur border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 transition-colors"
                title="Centrar mapa"
                aria-label="Centrar mapa"
              >
                <Locate className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && tables.length === 0 && (
        <div className="mt-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-6 text-center text-zinc-500 text-sm">
          Todavía no hay mesas en el mapa.{" "}
          {editMode ? (
            "Pulsa una celda para crear la primera."
          ) : (
            <button
              onClick={enterEditMode}
              className="text-teal-700 dark:text-teal-400 underline hover:no-underline"
            >
              Activa el modo edición para empezar
            </button>
          )}
        </div>
      )}

      {/* Panel de detalle (modo vista) */}
      {selectedLive && !editMode && (
        <Modal onClose={() => setSelected(null)} maxWidth="max-w-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Mesa {selectedLive.number}
                {selectedLive.name && (
                  <span className="text-zinc-500 font-normal">
                    {" "}
                    · {selectedLive.name}
                  </span>
                )}
              </h3>
              <span
                className={`inline-flex items-center mt-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${TABLE_STATUS_CELL[selectedLive.status]}`}
              >
                {TABLE_STATUS_LABEL[selectedLive.status]}
              </span>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-lg"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <p className="flex items-center gap-1.5 text-sm text-zinc-500 mb-4">
            <Users className="w-4 h-4" strokeWidth={1.8} />
            {selectedLive.seats} comensales
          </p>

          {/* Cada pedido de la sesión con sus propias acciones (avanzar,
              editar, cancelar, imprimir) — las mismas que en Gestión de
              pedidos, para no tener que salir del mapa para tocar algo. */}
          {selectedLive.status !== "LIBRE" && (
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mb-4 space-y-3">
              {sessionLoading ? (
                <div className="flex justify-center py-4">
                  <Spinner className="w-5 h-5 text-zinc-500" />
                </div>
              ) : session ? (
                <>
                  {/* Solo lo que sigue en curso (en cocina o listo): lo ya
                      entregado o cancelado no es "el pedido actual" de la
                      mesa, y verlo aquí mezclado es justo lo que confundía.
                      Sigue contando para el total y para "Cerrar y cobrar"
                      más abajo, solo que sin tarjeta propia en esta lista. */}
                  {(() => {
                    const currentOrders = session.orders.filter((o) =>
                      ["IN_PROGRESS", "READY"].includes(o.status),
                    );
                    if (currentOrders.length === 0) {
                      return (
                        <p className="text-sm text-zinc-500 text-center py-2">
                          Todo entregado — lista para cobrar
                        </p>
                      );
                    }
                    return [...currentOrders]
                      .sort((a, b) => a.id - b.id)
                      .map((order) => (
                        <SessionOrderCard
                          key={order.id}
                          order={order}
                          busy={
                            orderStatusMutation.isPending &&
                            orderStatusMutation.variables?.orderId === order.id
                          }
                          onCancel={() => setCancelOrderConfirm(order)}
                          onEdit={() =>
                            navigate(
                              `/restaurant/${slug}/orders/${order.id}?from=map`,
                            )
                          }
                          onPrint={() =>
                            void printOrderTicket(
                              order,
                              restaurantName,
                              access?.address,
                            )
                          }
                          onAdvance={() => {
                            const next = NEXT_ACTION[order.status];
                            if (next) {
                              orderStatusMutation.mutate({
                                orderId: order.id,
                                status: next.next,
                                expectedUpdatedAt: order.updatedAt,
                              });
                            }
                          }}
                        />
                      ));
                  })()}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      Total
                    </span>
                    <span className="text-base font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {money(selectedLive.total)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* "Añadir a la comanda" suma platos al mismo ticket ya abierto de
              la mesa (misma familia, más comida); "Pedido aparte" es la
              excepción explícita para cuando alguien de la mesa quiere
              pagar por separado. */}
          <div className="flex flex-col gap-2">
            <button
              disabled={stillResolvingSession}
              onClick={() =>
                navigate(
                  activeSessionOrder
                    ? `/restaurant/${slug}/orders/${activeSessionOrder.id}?from=map&mode=add`
                    : `/restaurant/${slug}/orders/new?table=${selectedLive.number}&from=map`,
                )
              }
              className="flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
            >
              {stillResolvingSession ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <UtensilsCrossed className="w-4 h-4" strokeWidth={2} />
              )}
              {stillResolvingSession
                ? "Cargando…"
                : activeSessionOrder
                  ? "Añadir a la comanda"
                  : "Nuevo pedido"}
            </button>
            {activeSessionOrder && (
              <button
                onClick={() =>
                  navigate(
                    `/restaurant/${slug}/orders/new?table=${selectedLive.number}&from=map`,
                  )
                }
                title="Empieza un ticket aparte para esta mesa (p. ej. alguien que paga por separado)"
                className="flex items-center justify-center gap-2 px-4 py-3 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-bold rounded-xl transition-colors"
              >
                <UtensilsCrossed className="w-4 h-4" strokeWidth={2} />
                Nuevo pedido
              </button>
            )}
            {selectedLive.status === "PARA_COBRAR" &&
              selectedLive.tableSessionId && (
                <button
                  onClick={() => setCloseConfirm(selectedLive)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  <Receipt className="w-4 h-4" strokeWidth={2} />
                  Cerrar y cobrar
                </button>
              )}
          </div>
        </Modal>
      )}

      {/* Editor de mesa (crear/editar, solo en modo edición — cambios en borrador) */}
      {editingTable && (
        <Modal onClose={closeEditor} maxWidth="max-w-md">
          <form onSubmit={handleSubmitForm}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {editingTable === "new"
                  ? "Nueva mesa"
                  : `Editar mesa ${editingTable.number}`}
              </h3>
              <button
                type="button"
                onClick={closeEditor}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 rounded-lg"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl px-4 py-2.5 text-sm text-red-700 dark:text-red-400 mb-4">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="block text-xs font-medium text-zinc-500 mb-1">
                  Número
                </span>
                <input
                  type="number"
                  min={1}
                  value={form.number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, number: e.target.value }))
                  }
                  className={getInputClass()}
                  required
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-zinc-500 mb-1">
                  Comensales
                </span>
                <input
                  type="number"
                  min={1}
                  value={form.seats}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, seats: e.target.value }))
                  }
                  className={getInputClass()}
                  required
                />
              </label>
            </div>

            <label className="block mb-3">
              <span className="block text-xs font-medium text-zinc-500 mb-1">
                Nombre (opcional)
              </span>
              <input
                type="text"
                placeholder="Ej. Terraza, Ventana..."
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className={getInputClass()}
              />
            </label>

            <div className="mb-3">
              <span className="block text-xs font-medium text-zinc-500 mb-1.5">
                Forma
              </span>
              <div className="grid grid-cols-2 gap-2">
                {SHAPE_OPTIONS.map(({ value, label, icon: ShapeIcon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, shape: value }))}
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
                      form.shape === value
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400"
                        : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <ShapeIcon className="w-4 h-4" strokeWidth={1.8} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <label className="block">
                <span className="block text-xs font-medium text-zinc-500 mb-1">
                  Ancho (celdas)
                </span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={form.width}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, width: e.target.value }))
                  }
                  className={getInputClass()}
                  required
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-zinc-500 mb-1">
                  Alto (celdas)
                </span>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={form.height}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, height: e.target.value }))
                  }
                  className={getInputClass()}
                  required
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-3">
              {editingTable !== "new" ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirm(editingTable);
                    closeEditor();
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.8} />
                  Eliminar
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {editingTable === "new" ? "Añadir" : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          title="¿Eliminar mesa?"
          message={
            <>
              Se quitará la{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                Mesa {deleteConfirm.number}
              </span>{" "}
              del mapa (no se aplicará hasta que pulses "Guardar"). Esto no
              afecta a sus pedidos o reservas históricos.
            </>
          }
          confirmLabel="Eliminar"
          onConfirm={confirmDeleteDraftTable}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {closeConfirm && (
        <ConfirmDialog
          title="¿Cerrar y cobrar?"
          message={
            <>
              Se cerrará la cuenta de la{" "}
              <span className="text-zinc-700 dark:text-zinc-300 font-medium">
                Mesa {closeConfirm.number}
              </span>
              , combinando todos sus pedidos en un único ticket. Esta acción no
              se puede deshacer.
            </>
          }
          confirmLabel="Cerrar y cobrar"
          cancelLabel="Volver"
          tone="warning"
          loading={closeSessionMutation.isPending}
          onConfirm={() =>
            closeConfirm.tableSessionId &&
            closeSessionMutation.mutate(closeConfirm.tableSessionId)
          }
          onCancel={() => setCloseConfirm(null)}
        />
      )}

      {cancelOrderConfirm && (
        <CancelOrderConfirmDialog
          order={cancelOrderConfirm}
          loading={
            orderStatusMutation.isPending &&
            orderStatusMutation.variables?.orderId === cancelOrderConfirm.id
          }
          onConfirm={() =>
            orderStatusMutation.mutate({
              orderId: cancelOrderConfirm.id,
              status: "CANCELLED",
              expectedUpdatedAt: cancelOrderConfirm.updatedAt,
            })
          }
          onCancel={() => setCancelOrderConfirm(null)}
        />
      )}
    </div>
  );
}
