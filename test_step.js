const fs = require('fs');

async function test() {
  const mod = await import('opencascade.js/dist/opencascade.wasm.js');
  const initOpenCascade = mod.default || mod;
  const oc = await initOpenCascade();
  
  // Create a dummy simple STEP file string
  const stepContent = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Open CASCADE Model'),'2;1');
FILE_NAME('Open CASCADE Shape Model','2023-01-01T00:00:00',('Author'),(''),'Open CASCADE STEP processor 7.6','Open CASCADE 7.6','Unknown');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN_CC2 { 1 2 10303 214 -1 1 5 4 }'));
ENDSEC;
DATA;
#1 = APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#2);
#2 = APPLICATION_CONTEXT('core data for automotive mechanical design processes');
#3 = SHAPE_DEFINITION_REPRESENTATION(#4,#10);
#4 = PRODUCT_DEFINITION_SHAPE('','',#5);
#5 = PRODUCT_DEFINITION('design','',#6,#9);
#6 = PRODUCT_DEFINITION_FORMATION('','',#7);
#7 = PRODUCT('dummy','dummy','',(#8));
#8 = PRODUCT_CONTEXT('',#2,'mechanical');
#9 = PRODUCT_DEFINITION_CONTEXT('part definition',#2,'design');
#10 = SHAPE_REPRESENTATION('',(#11),#15);
#11 = AXIS2_PLACEMENT_3D('',#12,#13,#14);
#12 = CARTESIAN_POINT('',(0.,0.,0.));
#13 = DIRECTION('',(0.,0.,1.));
#14 = DIRECTION('',(1.,0.,0.));
#15 = ( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#19)) GLOBAL_UNIT_ASSIGNED_CONTEXT((#16,#17,#18)) REPRESENTATION_CONTEXT('Context #1','3D Context with UNIT and UNCERTAINTY') );
#16 = ( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) );
#17 = ( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) );
#18 = ( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() );
#19 = UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#16,'distance_accuracy_value','confusion accuracy');
#20 = PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(#7));
ENDSEC;
END-ISO-10303-21;
`;

  const uint8 = new TextEncoder().encode(stepContent);
  oc.FS.writeFile("/upload.step", uint8);
  const reader = new oc.STEPControl_Reader_1();
  const res = reader.ReadFile("/upload.step");
  const actualVal = typeof res === "object" ? res.value : res;
  console.log("Read result for /upload.step:", actualVal);
  
  oc.FS.writeFile("upload2.step", uint8);
  const res2 = reader.ReadFile("upload2.step");
  const actualVal2 = typeof res2 === "object" ? res2.value : res2;
  console.log("Read result for upload2.step:", actualVal2);
  
  // What if we try to read a non-existent file?
  const res3 = reader.ReadFile("doesnotexist.step");
  const actualVal3 = typeof res3 === "object" ? res3.value : res3;
  console.log("Read result for non-existent:", actualVal3);
}

test().catch(console.error);
