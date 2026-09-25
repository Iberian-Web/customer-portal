// Imprime la cuenta de la MESA (todos los pedidos de la sesión combinados,
// igual que al cerrarla), no solo el pedido concreto sobre el que se pulsó
// "imprimir". Compartido entre OrdersManager y el Mapa de mesas.
import { tableSessionsApi, type Order } from "../api";

export async function printOrderTicket(order: Order) {
  const win = window.open("", "_blank", "width=380,height=600");
  if (!win) return;

  const session = await tableSessionsApi.get(order.tableSessionId);

  const rows = session.items
    .map(
      (it) => `
        <tr>
          <td style="padding:2px 0;">${it.quantity}×</td>
          <td style="padding:2px 6px;">${it.dishName}</td>
          <td style="padding:2px 0;text-align:right;">${(it.quantity * it.unitPrice).toFixed(2)} €</td>
        </tr>`,
    )
    .join("");

  const orderIds = session.orders
    .filter((o) => o.status !== "CANCELLED")
    .map((o) => `#${o.id}`)
    .join(", ");

  win.document.write(`
    <html>
      <head>
        <title>Mesa ${session.tableNumber}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 13px; padding: 16px; color: #111; }
          h1 { font-size: 16px; margin: 0 0 4px; text-align: center; }
          p { margin: 2px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .divider { border-top: 1px dashed #999; margin: 10px 0; }
          .total { font-weight: bold; font-size: 14px; }
        </style>
      </head>
      <body>
        <h1>Mesa ${session.tableNumber}</h1>
        <p style="text-align:center;">${session.waiterName}</p>
        <p style="text-align:center;">Pedidos ${orderIds}</p>
        <p style="text-align:center;">${new Date(session.openedAt).toLocaleString("es-ES")}</p>
        <div class="divider"></div>
        <table>${rows}</table>
        <div class="divider"></div>
        <p class="total" style="text-align:right;">TOTAL: ${session.total.toFixed(2)} €</p>
        ${session.notes ? `<div class="divider"></div><p>Notas: ${session.notes}</p>` : ""}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
