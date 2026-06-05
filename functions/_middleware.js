export async function onRequest(context) {
  const response = await context.next();
  if (response.status === 404) {
    return context.env.ASSETS.fetch(
      new Request(new URL('/index.html', context.request.url).toString()),
    );
  }
  return response;
}
