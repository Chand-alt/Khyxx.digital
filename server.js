const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const nodemailer = require('nodemailer');

const port = Number(process.env.PORT || 3000);
const root = __dirname;
const ordersFile = path.join(root, 'data', 'orders.json');
const paypalBase = process.env.PAYPAL_ENV === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function readOrders() {
  try {
    return JSON.parse(await fs.readFile(ordersFile, 'utf8'));
  } catch {
    return [];
  }
}

async function writeOrders(orders) {
  await fs.mkdir(path.dirname(ordersFile), { recursive: true });
  await fs.writeFile(ordersFile, JSON.stringify(orders, null, 2));
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function requestBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return JSON.parse(body || '{}');
}

async function paypalToken() {
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${paypalBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  if (!response.ok) throw new Error(`PayPal authentication failed (${response.status})`);
  return (await response.json()).access_token;
}

async function paypalRequest(endpoint, options = {}) {
  const token = await paypalToken();
  const response = await fetch(`${paypalBase}${endpoint}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || `PayPal request failed (${response.status})`);
  return result;
}

async function notifyOwner(order) {
  if (!process.env.SMTP_HOST || !process.env.ORDER_NOTIFICATION_EMAIL) return;
  const weddingDetails = order.weddingDetails
    ? `\nWedding details:\nCouple: ${order.weddingDetails.coupleNames}\nDate: ${order.weddingDetails.weddingDate}\nVenue: ${order.weddingDetails.venue}\nContent and notes: ${order.weddingDetails.content}`
    : '';
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: process.env.ORDER_NOTIFICATION_EMAIL,
    subject: `New Khyxx Digitals order ${order.id}`,
    text: `Buyer: ${order.buyer.name} <${order.buyer.email}>\nItems: ${order.items.map(item => `${item.name} x${item.quantity}`).join(', ')}\nTotal: PHP ${order.total}\nPayment method: ${order.paymentMethod === 'gcash' ? 'GCash' : 'Bank transfer'}\nPayment status: ${order.paymentStatus}${weddingDetails}`
  });
}

function adminAuthorized(request) {
  return Boolean(process.env.ADMIN_KEY) && request.headers['x-admin-key'] === process.env.ADMIN_KEY;
}

async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (request.method === 'POST' && url.pathname === '/api/orders') {
      const input = await requestBody(request);
      if (!input.buyer?.name || !input.buyer?.email || !Array.isArray(input.items) || !input.items.length) {
        return sendJson(response, 400, { error: 'Buyer name, email, and at least one item are required.' });
      }
      if (!['bank_transfer', 'gcash'].includes(input.paymentMethod)) {
        return sendJson(response, 400, { error: 'Choose bank transfer or GCash as your payment method.' });
      }
      const items = input.items.map(item => ({
        name: String(item.name).slice(0, 120),
        price: Number(item.price),
        quantity: Math.max(1, Number(item.quantity || 1))
      }));
      if (items.some(item => !item.name || !Number.isFinite(item.price) || item.price < 0)) {
        return sendJson(response, 400, { error: 'Invalid cart item.' });
      }
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const order = {
        id: `KX-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        buyer: { name: String(input.buyer.name).slice(0, 120), email: String(input.buyer.email).slice(0, 200) },
        items,
        total,
        currency: 'PHP',
        paymentMethod: input.paymentMethod,
        paymentStatus: 'PENDING',
        createdAt: new Date().toISOString()
      };
      const orders = await readOrders();
      orders.push(order);
      await writeOrders(orders);
      await notifyOwner(order);
      return sendJson(response, 201, { orderId: order.id, paymentMethod: order.paymentMethod });
    }

    if (request.method === 'POST' && url.pathname === '/api/paypal/capture') {
      const input = await requestBody(request);
      const orders = await readOrders();
      const order = orders.find(item => item.id === input.orderId && item.paypalOrderId === input.paypalOrderId);
      if (!order) return sendJson(response, 404, { error: 'Order not found.' });
      const capture = await paypalRequest(`/v2/checkout/orders/${order.paypalOrderId}/capture`, { method: 'POST' });
      order.paymentStatus = capture.status === 'COMPLETED' ? 'PAID' : capture.status;
      order.paidAt = new Date().toISOString();
      await writeOrders(orders);
      await notifyOwner(order);
      return sendJson(response, 200, { orderId: order.id, paymentStatus: order.paymentStatus });
    }

    if (request.method === 'POST' && url.pathname === '/api/order-details') {
      const input = await requestBody(request);
      const orders = await readOrders();
      const order = orders.find(item => item.id === input.orderId);
      if (!order) return sendJson(response, 404, { error: 'Order not found.' });
      if (!input.coupleNames || !input.weddingDate || !input.venue || !input.content) {
        return sendJson(response, 400, { error: 'Please complete all wedding details.' });
      }
      order.weddingDetails = {
        coupleNames: String(input.coupleNames).slice(0, 160),
        weddingDate: String(input.weddingDate).slice(0, 30),
        venue: String(input.venue).slice(0, 240),
        content: String(input.content).slice(0, 2000),
        submittedAt: new Date().toISOString()
      };
      await writeOrders(orders);
      await notifyOwner(order);
      return sendJson(response, 200, { orderId: order.id });
    }

    if (request.method === 'GET' && url.pathname === '/api/admin/orders') {
      if (!adminAuthorized(request)) return sendJson(response, 401, { error: 'Unauthorized.' });
      return sendJson(response, 200, await readOrders());
    }

    if (request.method === 'GET') {
      const file = url.pathname === '/' ? 'Home.html' : url.pathname.slice(1);
      const filePath = path.resolve(root, file);
      if (!filePath.startsWith(root) || filePath.endsWith('server.js')) return sendJson(response, 404, { error: 'Not found.' });
      const content = await fs.readFile(filePath);
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
      response.writeHead(200, { 'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      return response.end(content);
    }
    sendJson(response, 404, { error: 'Not found.' });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Unable to process the request.' });
  }
}

http.createServer(handle).listen(port, () => console.log(`Khyxx Digitals server running on port ${port}`));
