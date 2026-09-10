export type OfficeLocale='zh-CN'|'en-US';
export function resolveOfficeLocale(value:unknown,fallback:OfficeLocale='zh-CN'):OfficeLocale{
 if(typeof value!=='string')return fallback;
 const legacy:Record<string,string>={enus:'en-US',zhcn:'zh-CN'};
 try{
  const language=new Intl.Locale(legacy[value.toLowerCase()]??value.replaceAll('_','-')).language;
  if(language==='en')return 'en-US';
  if(language==='zh')return 'zh-CN';
 }catch{/* Invalid host preferences do not override the last supported language. */}
 return fallback;
}

const english:Record<string,string>={
 '刷新预览':'Refresh preview','全屏':'Fullscreen','浮窗':'Pop out','返回卡片':'Back to card',
 '打开编辑与审阅':'Open editor and review','连接预览…':'Connecting preview…','等待工具结果':'Waiting for tool result',
 '预览操作':'Preview actions','Univer Office 预览':'Univer Office preview','预览失败':'Preview failed',
 '草稿':'Draft','当前版本':'Saved version','版本':'Version','第':'Page','页':'',
 '正在编辑草稿':'Draft in progress','等待你的审阅':'Ready for review','已合入':'Merged','已丢弃':'Discarded',
 '部分合入，需检查结果':'Partially merged — review the result','只读实时预览':'Read-only live preview',
 '尚未生成图片，点击“刷新预览”获取当前内容。':'No images yet. Refresh the preview to capture the current content.',
 '预览调用已取消。':'Preview request cancelled.','客户端未能打开审阅页。':'The host could not open the review page.',
 '客户端保留了当前显示模式，可通过“打开编辑与审阅”查看完整内容。':'The host kept the current display mode. Open the editor and review to see the full content.',
 '内嵌预览只读并实时同步；截图为捕获时的已确认版本。编辑、合入或丢弃请打开审阅页。':'The embedded preview is read-only and updates live. Images show the confirmed version at capture time. Open the review page to edit, merge or discard.',
 '表格':'Sheets','文档':'Docs','幻灯片':'Slides','多维表格':'Base','白板':'Board',
 '修改中 · 只读':'Draft · Read-only','待确认':'Ready for review','合入尚未全部完成':'Merge incomplete',
 '草稿已合入':'Draft merged','草稿已丢弃':'Draft discarded','草稿内容待移除':'Draft content marked for removal',
 '草稿已合入 · 内容已移除':'Draft merged · Content removed','草稿已合入 · 当前版本':'Draft merged · Saved version','草稿已丢弃 · 当前版本':'Draft discarded · Saved version',
 '只读预览':'Read-only preview','只读查看':'Read-only view','主线可编辑':'Editing saved version',
 '尚未建立协作连接':'Not connected','● 已同步':'● Synced','等待发送更改…':'Waiting to send changes…',
 '等待服务端确认…':'Waiting for server confirmation…','等待确认，仍有更改待发送…':'Waiting for confirmation; more changes are pending…',
 '正在补齐远端更改…':'Fetching remote changes…','正在处理同步冲突…':'Resolving sync conflicts…',
 '连接已断开 · 内容可能不是最新版本':'Disconnected · Content may be out of date',
 '当前文件暂无内容':'This file has no content','连接协作服务…':'Connecting to collaboration…',
 '正在加载 Office 编辑器…':'Loading Office…','WorkBuddy · 实时 Office 预览':'WorkBuddy · Live Office preview',
 '切换浅色主题':'Switch to light theme','切换深色主题':'Switch to dark theme','退出全屏':'Exit fullscreen','适应页面':'Fit page',
 '文件不可用':'File unavailable','文件暂时不可用':'File temporarily unavailable',
 '文件可能已移走、删除或被替换。已停止当前预览和操作，请恢复原文件，或重新打开文件。':'The file may have been moved, deleted or replaced. Preview and actions are paused. Restore the file or open it again.',
 '文件不可用 · 已停止当前预览，等待原文件恢复':'File unavailable · Preview paused until the original file is restored',
 '无法确认服务状态 · 内容可能不是最新版本 · 正在重试…':'Cannot confirm service status · Content may be out of date · Retrying…',
};
export function localeText(locale:OfficeLocale,chinese:string){return locale==='en-US'?english[chinese]??chinese:chinese;}
