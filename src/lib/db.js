import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const key = (date) => `subs:${date}`;
const monthKey = (date) => `subs:month:${date.slice(0, 7)}`;

export async function upsert(submission) {
  const k = key(submission.date);
  await redis.hset(k, { [submission.name]: JSON.stringify(submission) });
  await redis.expire(k, 60 * 60 * 24 * 7);
  // Arquivo mensal — 1 ano
  const mk = monthKey(submission.date);
  await redis.hset(mk, { [`${submission.date}:${submission.name}`]: JSON.stringify(submission) });
  await redis.expire(mk, 60 * 60 * 24 * 365);
}

export async function updateSubmissionAction(date, name, action) {
  const k = key(date);
  const current = await redis.hget(k, name);
  if (!current) return;
  const sub = typeof current === 'string' ? JSON.parse(current) : current;
  sub._action = action;
  await redis.hset(k, { [name]: JSON.stringify(sub) });
}

export async function deleteSubmission(date, name) {
  await redis.hdel(key(date), name);
}

export async function todaySubmissions() {
  const today = new Date().toISOString().slice(0, 10);
  const hash = await redis.hgetall(key(today));
  if (!hash) return [];
  return Object.values(hash).map((v) => (typeof v === 'string' ? JSON.parse(v) : v));
}

export async function submissionsByDate(date) {
  const hash = await redis.hgetall(key(date));
  if (!hash) return [];
  return Object.values(hash).map((v) => (typeof v === 'string' ? JSON.parse(v) : v));
}

export async function addCncEntry(entry) {
  const k = `cnc:${entry.date}`;
  await redis.lpush(k, JSON.stringify(entry));
  await redis.expire(k, 60 * 60 * 24 * 7);
  // Arquivo mensal — 1 ano
  const mk = `cnc:month:${entry.date.slice(0, 7)}`;
  await redis.lpush(mk, JSON.stringify(entry));
  await redis.expire(mk, 60 * 60 * 24 * 365);
}

export async function todayCncEntries() {
  const today = new Date().toISOString().slice(0, 10);
  const items = await redis.lrange(`cnc:${today}`, 0, -1);
  if (!items || items.length === 0) return [];
  return items.map((v) => (typeof v === 'string' ? JSON.parse(v) : v));
}

export async function saveObras(obras) {
  await redis.set('obras:list', JSON.stringify(obras));
}

export async function getObras() {
  const data = await redis.get('obras:list');
  if (!data) return [];
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function addPedido(pedido) {
  const k = `pedidos:${pedido.date}`;
  await redis.lpush(k, JSON.stringify(pedido));
  await redis.expire(k, 60 * 60 * 24 * 30);
}

export async function getPedidos(days = 7) {
  const results = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const items = await redis.lrange(`pedidos:${date}`, 0, -1);
    if (items && items.length > 0) {
      results.push(...items.map((v) => (typeof v === 'string' ? JSON.parse(v) : v)));
    }
  }
  const statuses = (await redis.hgetall('pedidos:status')) || {};
  return results.map((p) => ({ ...p, status: statuses[p.id] || p.status || 'pendente' }));
}

export async function updatePedidoStatus(id, status) {
  await redis.hset('pedidos:status', { [id]: status });
}

export async function getEstoque() {
  const data = await redis.get('lkn:estoque:list');
  if (!data) return [];
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function saveEstoque(items) {
  await redis.set('lkn:estoque:list', JSON.stringify(items));
}

// ── Gerente Fábrica ────────────────────────────────────────────────────────
export async function saveGerenteFab(date, data) {
  await redis.set(`gerente:fab:${date}`, JSON.stringify(data));
  await redis.expire(`gerente:fab:${date}`, 60 * 60 * 24 * 30);
}

export async function getGerenteFab(date) {
  const data = await redis.get(`gerente:fab:${date}`);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

// ── CNC Ativo (lock por máquina) ───────────────────────────────────────────
export async function getCncAtivo(maquina) {
  const data = await redis.get(`cnc:ativo:${maquina}`);
  if (!data) return null;
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function setCncAtivo(maquina, corte) {
  await redis.set(`cnc:ativo:${maquina}`, JSON.stringify(corte));
  await redis.expire(`cnc:ativo:${maquina}`, 60 * 60 * 24); // 24h auto-expire
}

export async function clearCncAtivo(maquina) {
  await redis.del(`cnc:ativo:${maquina}`);
}

export async function updateCncConcluido(id) {
  await redis.hset('cnc:concluidos', { [id]: '1' });
}

// ── Registros (histórico persistente) ─────────────────────────────────────
export async function addRegistro(registro) {
  const ym = registro.date.slice(0, 7); // YYYY-MM
  const k = `registros:${ym}`;
  await redis.lpush(k, JSON.stringify(registro));
  await redis.expire(k, 60 * 60 * 24 * 365); // 1 ano
}

export async function getRegistros(startDate, endDate) {
  const months = [];
  const cur = new Date(startDate.slice(0, 7) + '-01T12:00:00Z');
  const endYM = endDate.slice(0, 7);
  while (cur.toISOString().slice(0, 7) <= endYM) {
    months.push(cur.toISOString().slice(0, 7));
    cur.setMonth(cur.getMonth() + 1);
  }
  const results = [];
  for (const ym of months) {
    const items = await redis.lrange(`registros:${ym}`, 0, -1);
    if (items?.length) {
      results.push(...items.map((v) => (typeof v === 'string' ? JSON.parse(v) : v)));
    }
  }
  return results
    .filter((r) => r.date >= startDate && r.date <= endDate)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

// ── Termos de Recebimento ─────────────────────────────────────────────────
export async function saveTermoRecebimento(termo) {
  const lista = await getTermosRecebimento();
  lista.unshift(termo); // mais recente primeiro
  await redis.set('termos:recebimento', JSON.stringify(lista.slice(0, 200)));
}

export async function getTermosRecebimento() {
  const data = await redis.get('termos:recebimento');
  if (!data) return [];
  return typeof data === 'string' ? JSON.parse(data) : data;
}

export async function addNota(nota) {
  const k = `notas:${nota.date}`;
  await redis.lpush(k, JSON.stringify(nota));
  await redis.expire(k, 60 * 60 * 24 * 30);
}

export async function getNotas(date) {
  const items = await redis.lrange(`notas:${date}`, 0, -1);
  if (!items || items.length === 0) return [];
  return items.map((v) => (typeof v === 'string' ? JSON.parse(v) : v));
}

// ── Histórico de logins ────────────────────────────────────────────────────
export async function addLoginEvent(event) {
  await redis.lpush('login:history', JSON.stringify(event));
  await redis.ltrim('login:history', 0, 499);
}

export async function getLoginHistory(limit = 200) {
  const items = await redis.lrange('login:history', 0, limit - 1);
  return (items || []).map((v) => (typeof v === 'string' ? JSON.parse(v) : v));
}

export async function updateUserActivity(userId, nome, role) {
  await redis.hset('user:activity', { [userId]: JSON.stringify({ nome, role, timestamp: new Date().toISOString() }) });
}

export async function getActiveUsers(timeoutSeconds = 300) {
  const activities = await redis.hgetall('user:activity') || {};
  const now = Date.now();
  const users = [];

  Object.entries(activities).forEach(([userId, data]) => {
    const user = typeof data === 'string' ? JSON.parse(data) : data;
    const lastActivity = new Date(user.timestamp).getTime();
    const isOnline = (now - lastActivity) < timeoutSeconds * 1000;
    users.push({
      id: userId,
      nome: user.nome,
      role: user.role,
      timestamp: user.timestamp,
      isOnline,
    });
  });

  return users.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}
