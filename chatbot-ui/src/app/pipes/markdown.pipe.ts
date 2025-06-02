import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';

    let html = value;

    const codeBlocks: string[] = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      const idx = codeBlocks.length;
      codeBlocks.push(
        `<pre><code>${this.escapeHtml(code.trim())}</code></pre>`
      );
      return `__CODE_BLOCK_${idx}__`;
    });

    codeBlocks.forEach((block, idx) => {
      html = html.replace(`__CODE_BLOCK_${idx}__`, block);
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    html = html.replace(/(?<!^[\s]*[-*]\s)\*([^*\n]+)\*/g, '<em>$1</em>');
    html = html.replace(/(?<!^[\s]*[-*]\s)_([^_\n]+)_/g, '<em>$1</em>');

    html = this.processLists(html);

    html = html.replace(/(<\/h[1-6]>)\n/g, '$1');
    html = html.replace(/(<\/ul>)\n/g, '$1');
    html = html.replace(/(<\/ol>)\n/g, '$1');
    html = html.replace(/(<\/pre>)\n/g, '$1');

    html = html.replace(/\n/g, '<br>');

    html = html.replace(/(<br>){2,}/g, '<br>');
    html = html.replace(/(<ul>)<br>/g, '$1');
    html = html.replace(/<br>(<\/ul>)/g, '$1');
    html = html.replace(/(<\/li>)<br>(<li>)/g, '$1$2');

    return this.sanitizer.sanitize(1, html) || '';
  }

  private processLists(html: string): string {
    const lines = html.split('\n');
    const processedLines: string[] = [];
    let currentList: { type: string; items: string[]; indent: number } | null =
      null;
    let inBoldSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
        if (currentList) {
          processedLines.push(this.createListHtml(currentList));
          currentList = null;
        }
        processedLines.push(line);
        inBoldSection = true;
        continue;
      }

      const unorderedMatch = line.match(/^(\s*)[-*]\s+(.+)/);
      const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)/);

      if (unorderedMatch || orderedMatch) {
        const isOrdered = !!orderedMatch;
        const indent = isOrdered
          ? unorderedMatch?.[1]?.length || 0
          : unorderedMatch?.[1]?.length || 0;
        const content = isOrdered ? orderedMatch[3] : unorderedMatch?.[2] || '';

        if (inBoldSection && !currentList) {
          processedLines.push('');
          inBoldSection = false;
        }

        if (!currentList || currentList.type !== (isOrdered ? 'ol' : 'ul')) {
          if (currentList) {
            processedLines.push(this.createListHtml(currentList));
          }
          currentList = {
            type: isOrdered ? 'ol' : 'ul',
            items: [content],
            indent: indent,
          };
        } else {
          currentList.items.push(content);
        }
      } else {
        if (currentList) {
          processedLines.push(this.createListHtml(currentList));
          currentList = null;
        }
        processedLines.push(line);
        if (trimmedLine !== '') {
          inBoldSection = false;
        }
      }
    }

    if (currentList) {
      processedLines.push(this.createListHtml(currentList));
    }

    return processedLines.join('\n');
  }

  private createListHtml(list: {
    type: string;
    items: string[];
    indent: number;
  }): string {
    const tag = list.type;
    const items = list.items.map((item) => `<li>${item}</li>`).join('');
    const style =
      list.indent > 0 ? ` style="margin-left: ${list.indent * 20}px;"` : '';
    return `<${tag}${style}>${items}</${tag}>`;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
