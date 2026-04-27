import ocjs from 'opencascade.js';

async function run() {
  console.log('Loading OpenCASCADE...');
  const oc = await ocjs();
  console.log('Loaded OpenCASCADE');
  
  const reader = new oc.STEPControl_Reader_1();
  const stepData = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Open CASCADE Model'),'2;1');
FILE_NAME('Open CASCADE Shape Model','2026-04-27T00:00:00',('Author'),('Open CASCADE'),'Open CASCADE Processor version 7.6.0','Open CASCADE','');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));
ENDSEC;
DATA;
#1 = APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#2);
#2 = APPLICATION_CONTEXT('core data for automotive mechanical design processes');
#3 = SHAPE_DEFINITION_REPRESENTATION(#4,#10);
#4 = PRODUCT_DEFINITION_SHAPE('','',#5);
#5 = PRODUCT_DEFINITION('design','',#6,#9);
#6 = PRODUCT_DEFINITION_FORMATION('','',#7);
#7 = PRODUCT('Open CASCADE STEP translator 7.6 1','Open CASCADE STEP translator 7.6 1','',(#8));
#8 = PRODUCT_CONTEXT('',#2,'mechanical');
#9 = PRODUCT_DEFINITION_CONTEXT('part definition',#2,'design');
#10 = SHAPE_REPRESENTATION('',(#11,#15),#19);
#11 = AXIS2_PLACEMENT_3D('',#12,#13,#14);
#12 = CARTESIAN_POINT('',(0.,0.,0.));
#13 = DIRECTION('',(0.,0.,1.));
#14 = DIRECTION('',(1.,0.,0.));
#15 = MANIFOLD_SOLID_BREP('',#16);
#16 = CLOSED_SHELL('',(#17));
#17 = ADVANCED_FACE('',(#18),#19,.T.);
#18 = FACE_BOUND('',#20,.T.);
#19 = PLANE('',#11);
#20 = EDGE_LOOP('',(#21,#22,#23));
#21 = ORIENTED_EDGE('',*,*,#24,.T.);
#22 = ORIENTED_EDGE('',*,*,#25,.T.);
#23 = ORIENTED_EDGE('',*,*,#26,.T.);
#24 = EDGE_CURVE('',#27,#28,#29,.T.);
#25 = EDGE_CURVE('',#28,#30,#31,.T.);
#26 = EDGE_CURVE('',#30,#27,#32,.T.);
#27 = VERTEX_POINT('',#12);
#28 = VERTEX_POINT('',#33);
#29 = LINE('',#12,#14);
#30 = VERTEX_POINT('',#34);
#31 = LINE('',#33,#35);
#32 = LINE('',#34,#36);
#33 = CARTESIAN_POINT('',(1.,0.,0.));
#34 = CARTESIAN_POINT('',(0.,1.,0.));
#35 = DIRECTION('',(-1.,1.,0.));
#36 = DIRECTION('',(0.,-1.,0.));
ENDSEC;
END-ISO-10303-21;
`;

  oc.FS.writeFile('/test.step', stepData);
  const result = reader.ReadFile('/test.step');
  
  const val = typeof result === 'object' ? result.value : result;
  console.log('Read result:', val);
  
  if (val !== 1) {
    console.log('Error details:');
    reader.PrintCheckLoad(true, 1);
  }
}

run().catch(console.error);
