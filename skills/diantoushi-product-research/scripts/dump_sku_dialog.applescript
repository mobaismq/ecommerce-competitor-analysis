-- 用途：在店透视 SKU预览 弹窗打开的状态下，导出弹窗 HTML 结构供分析
-- 运行：osascript dump_sku_dialog.applescript > /tmp/sku_dialog.html
-- （需在你的终端运行，且 Chrome 前台标签页停留在商品详情页）
tell application "Google Chrome"
	set jsCode to "(()=>{const d=[...document.querySelectorAll('.el-dialog')].find(x=>(x.innerText||'').includes('SKU预览')&&x.getBoundingClientRect().width>100); return d?d.outerHTML.slice(0,300000):'NO_DIALOG';})()"
	return execute active tab of front window javascript jsCode
end tell
