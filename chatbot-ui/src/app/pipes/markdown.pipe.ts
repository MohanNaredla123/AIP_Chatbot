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

    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    html = html.replace(/(?<!^[\s]*[-*]\s)\*([^*\n]+)\*/g, '<em>$1</em>');
    html = html.replace(/(?<!^[\s]*[-*]\s)_([^_\n]+)_/g, '<em>$1</em>');

    let lines = html.split('\n');
    let inList = false;
    let listItems = [];
    let processedLines = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (line.match(/^\s*[-*]\s+(.+)/) || line.match(/^\s*\d+\.\s+(.+)/)) {
        let content = line
          .replace(/^\s*[-*]\s+/, '')
          .replace(/^\s*\d+\.\s+/, '');
        listItems.push(`<li>${content}</li>`);
        inList = true;
      } else {
        if (inList && listItems.length > 0) {
          processedLines.push(`<ul>${listItems.join('')}</ul>`);
          listItems = [];
          inList = false;
        }

        if (line.trim()) {
          processedLines.push(line);
        } else if (
          i > 0 &&
          lines[i - 1].trim() &&
          i < lines.length - 1 &&
          lines[i + 1].trim()
        ) {
          processedLines.push('');
        }
      }
    }

    if (inList && listItems.length > 0) {
      processedLines.push(`<ul>${listItems.join('')}</ul>`);
    }

    html = processedLines.join('\n');

    html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

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
}
