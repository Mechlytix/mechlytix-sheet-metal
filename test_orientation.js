const ocjs = require('opencascade.js');

async function run() {
  console.log('Loading OpenCASCADE...');
  const oc = await ocjs();
  console.log('Loaded.');
  console.log("TopAbs_Orientation exists:", !!oc.TopAbs_Orientation);
  if (oc.TopAbs_Orientation) {
    console.log("TopAbs_Orientation keys:", Object.keys(oc.TopAbs_Orientation));
    console.log("TopAbs_REVERSED value:", oc.TopAbs_Orientation.TopAbs_REVERSED);
    // Let's also print keys on a face shape if we can
    const shape = new oc.TopoDS_Shape();
    console.log("Orientation method exists on shape:", typeof shape.Orientation);
    shape.delete();
  }
}
run().catch(console.error);
