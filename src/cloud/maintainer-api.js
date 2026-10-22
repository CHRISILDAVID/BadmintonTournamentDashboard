export async function maintainerRequest(path, body, signal) {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", signal,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || "Could not reach the cloud. Try again."), { status: response.status });
  return data;
}
