// inputs
const rootId = "jt_root";
const maxDepth = 2;

// 1) Lấy node theo depth
const [d0, d1, d2] = await Promise.all([
  prisma.jobClosure.findMany({ where: { ancestorId: rootId, depth: 0 }, select: { descendantId: true } }),
  prisma.jobClosure.findMany({ where: { ancestorId: rootId, depth: 1 }, select: { descendantId: true } }),
  prisma.jobClosure.findMany({ where: { ancestorId: rootId, depth: 2 }, select: { descendantId: true } })
]);

const ids = [...new Set([rootId, ...d1.map(x=>x.descendantId), ...d2.map(x=>x.descendantId)])];

const titles = await prisma.jobTitle.findMany({
  where: { id: { in: ids } },
  select: { id: true, name: true, slug: true }
});

// 2) Lấy edges chỉ giữa tầng 1 -> 2 (đảm bảo depth(to)=depth(from)+1)
const edges12 = await prisma.jobEdge.findMany({
  where: { fromId: { in: d1.map(x=>x.descendantId) }, toId: { in: d2.map(x=>x.descendantId) } },
  select: { fromId: true, toId: true, likelihood: true }
});

// 3) Build payload cho FE
const nodes = {
  root: titles.find(t => t.id === rootId)!,
  depth1: titles.filter(t => d1.some(x => x.descendantId === t.id)),
  depth2: titles.filter(t => d2.some(x => x.descendantId === t.id))
};
const edgesByParent = edges12.reduce<Record<string, {to:string;likelihood?:any}[]>>((acc,e)=>{
  (acc[e.fromId] ||= []).push({ to: e.toId, likelihood: e.likelihood });
  return acc;
}, {});
//position-relative careerPaths_column__VCDCr careerPaths_left__RLeaj
//position-relative careerPaths_column__VCDCr careerPaths_right__ME3vJ
//position-relative careerPaths_column__VCDCr careerPaths_right__ME3vJ 