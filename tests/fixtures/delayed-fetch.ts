globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  if (url.pathname.endsWith("/result")) {
    return Response.json({
      url: "http://download.test/artifact.bin",
      object_key: "jobs/demo/output/artifact.bin",
      expires_seconds: 900,
    });
  }
  await Bun.sleep(100);
  return new Response(new Uint8Array(2 * 1024 * 1024).fill(7));
};
