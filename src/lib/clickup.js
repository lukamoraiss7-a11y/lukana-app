const BASE = 'https://api.clickup.com/api/v2';

async function cu(path, method, body) {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: token },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

export const postComment = (taskId, text) =>
  cu(`/task/${taskId}/comment`, 'POST', { comment_text: text });

// listId '901712152590' = Diarios de Obra (RDO)
export const createTask = (listId, name, description, assignees = []) =>
  cu(`/list/${listId}/task`, 'POST', { name, description, assignees });

export const attachFile = async (taskId, file) => {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) return null;
  try {
    const form = new FormData();
    form.append('attachment', file, file.name || 'foto.jpg');
    const res = await fetch(`${BASE}/task/${taskId}/attachment`, {
      method: 'POST',
      headers: { Authorization: token },
      body: form,
    });
    return res.ok ? await res.json() : null;
  } catch { return null; }
};
