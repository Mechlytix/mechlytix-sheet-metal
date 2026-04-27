async function test() {
  const mod = await import('opencascade.js/dist/opencascade.wasm.js');
  const initOpenCascade = mod.default || mod;
  const oc = await initOpenCascade();

  const reader = new oc.STEPControl_Reader_1();
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(reader));
  console.log("Methods on STEPControl_Reader_1:", methods);
}
test().catch(console.error);
