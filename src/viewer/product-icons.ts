import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {SheetsMultiIcon, DocsMultiIcon, SlidesMultiIcon, BasesMultiIcon, BoardsMultiIcon} from '@univerjs/icons';
import type {UnitKind} from '../shared/contracts.js';

const icons = {sheet: SheetsMultiIcon, doc: DocsMultiIcon, slide: SlidesMultiIcon, base: BasesMultiIcon, board: BoardsMultiIcon};
export const productNames = {sheet: '表格', doc: '文档', slide: '幻灯片', base: '多维表格', board: '白板'};
export function renderProductIcon(host: HTMLElement, kind: UnitKind) {
  host.classList.add('product-icon');host.setAttribute('aria-hidden', 'true');host.dataset.product=kind;
  const root=createRoot(host);root.render(createElement(icons[kind]));return root;
}
