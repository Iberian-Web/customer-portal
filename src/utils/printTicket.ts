// Imprime la cuenta de la MESA (todos los pedidos de la sesión combinados,
// igual que al cerrarla), no solo el pedido concreto sobre el que se pulsó
// "imprimir". Compartido entre OrdersManager y el Mapa de mesas.
import { tableSessionsApi, type Order } from "../api";

/** Escapa texto libre (notas, nombres) antes de meterlo en el HTML del ticket. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatTicketDate(iso: string): string {
  // Fecha "profesional" (sin segundos, con el mes en letra) en vez del
  // toLocaleString() por defecto del navegador, que añade los segundos y
  // resulta más propio de un log que de un recibo para el cliente.
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function printOrderTicket(
  order: Order,
  restaurantName?: string,
  restaurantAddress?: string,
) {
  const win = window.open("", "_blank", "width=380,height=600");
  if (!win) return;

  const session = await tableSessionsApi.get(order.tableSessionId);

  const rows = session.items
    .map(
      (it) => `
        <tr>
          <td style="padding:2px 0;">${it.quantity}×</td>
          <td style="padding:2px 6px;">${escapeHtml(it.dishName)}</td>
          <td style="padding:2px 0;text-align:right;">${(it.quantity * it.unitPrice).toFixed(2)} €</td>
        </tr>`,
    )
    .join("");

  const activeOrders = session.orders.filter((o) => o.status !== "CANCELLED");
  const orderIdsLabel = activeOrders.map((o) => `#${o.id}`).join(", ");
  // "Pedido #407" en singular (el caso normal) y "Pedidos #407, #408" solo
  // cuando de verdad hay más de uno en la mesa — antes decía "Pedidos" con
  // un único número, que leía raro.
  const orderWord = activeOrders.length === 1 ? "Pedido" : "Pedidos";

  const header = restaurantName
    ? `
        <h1>${escapeHtml(restaurantName)}</h1>
        ${restaurantAddress ? `<p style="text-align:center;color:#555;">${escapeHtml(restaurantAddress)}</p>` : ""}
        <div class="divider"></div>
        <p class="ticket-label">Ticket de mesa</p>
      `
    : `<p class="ticket-label">Ticket de mesa</p>`;

  win.document.write(`
    <html>
      <head>
        <title>${restaurantName ? `${restaurantName} · ` : ""}Mesa ${session.tableNumber}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 13px; padding: 16px; color: #111; }
          h1 { font-size: 17px; margin: 0 0 2px; text-align: center; letter-spacing: 0.02em; }
          p { margin: 2px 0; }
          .ticket-label { text-align:center; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10.5px; color: #555; }
          .meta { text-align:center; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .divider { border-top: 1px dashed #999; margin: 10px 0; }
          .total { font-weight: bold; font-size: 14px; }
          .footer { text-align:center; color:#555; font-size: 11px; margin-top: 14px; }
        </style>
      </head>
      <body>
        ${header}
        <p class="meta" style="font-size:15px;font-weight:bold;">Mesa ${session.tableNumber}</p>
        <p class="meta">${orderWord} ${orderIdsLabel}</p>
        <p class="meta">Atendido por ${escapeHtml(session.waiterName)}</p>
        <p class="meta">${formatTicketDate(session.openedAt)}</p>
        <div class="divider"></div>
        <table>${rows}</table>
        <div class="divider"></div>
        <p class="total" style="text-align:right;">TOTAL: ${session.total.toFixed(2)} €</p>
        ${session.notes ? `<div class="divider"></div><p>Notas: ${escapeHtml(session.notes)}</p>` : ""}
        <div class="footer">
          <p>Gracias por su visita</p>
        </div>
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
