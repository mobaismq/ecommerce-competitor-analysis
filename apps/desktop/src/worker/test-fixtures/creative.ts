export function creativeFixture() {
  const scripts = (count: number) => Array.from({ length: count }, (_, index) => ({ order: index + 1, purpose: `购买问题 ${index + 1}`, headline: '[我方品牌]真实规格展示', visual: '用我方实物与标尺展示产品，预留文案位', prompt: '使用我方真实参考图，保留准确产品结构和品牌，不生成虚构参数。', evidenceIds: [], requirements: ['我方实物、标签和规格'] }))
  return { title: '测试竞品出图策划', direction: '突出真实结构和可核实的规格', audience: '使用者与购买者分别核对', mainImages: scripts(5), detailImages: scripts(8), insights: [], risks: ['样本较少'], missingMaterials: ['我方商品资料'] }
}
