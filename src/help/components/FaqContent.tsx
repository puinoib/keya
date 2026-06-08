import { useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { marked } from 'marked';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from '@/components/ui/accordion';
import { convertInternalLinks } from '../lib/markdown';

interface FaqItem {
  question: string;
  answer: string;
}

function parseFaqMarkdown(content: string): FaqItem[] {
  const html = marked(content) as string;
  const container = document.createElement('div');
  container.innerHTML = html;

  const items: FaqItem[] = [];
  let currentQuestion = '';
  let currentParts: string[] = [];

  const flush = () => {
    if (currentQuestion) {
      items.push({
        question: currentQuestion,
        answer: currentParts.join(''),
      });
    }
    currentParts = [];
  };

  for (const child of Array.from(container.children)) {
    if (child instanceof HTMLElement && child.tagName === 'H2') {
      flush();
      currentQuestion = child.textContent || '';
    } else if (!(child instanceof HTMLElement && child.tagName === 'HR')) {
      currentParts.push(child.outerHTML);
    }
  }
  flush();

  return items;
}

export function FaqContent({ content }: { content: string }) {
  const items = parseFaqMarkdown(content);
  const navigate = useNavigate();
  const panelRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    panelRefs.current.forEach((el) => {
      const { html } = convertInternalLinks(el.innerHTML);
      el.innerHTML = html;
    });

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('[data-internal-link]');
      if (link) {
        e.preventDefault();
        const href = link.getAttribute('data-internal-link');
        if (href) {
          if (href.startsWith('/docs/')) {
            const slug = href.replace('/docs/', '');
            navigate({ to: '/docs/$slug', params: { slug } });
          } else {
            navigate({ to: href as never });
          }
        }
      }
    };

    const refs = panelRefs.current;
    for (const el of refs.values()) {
      el.addEventListener('click', handleClick);
    }

    return () => {
      for (const el of refs.values()) {
        el.removeEventListener('click', handleClick);
      }
    };
  }, [content, navigate]);

  return (
    <Accordion multiple className="w-full">
      {items.map((item, i) => (
        <AccordionItem key={i} value={String(i)}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionPanel
            ref={(el) => {
              if (el) {
                el.innerHTML = `<div class="prose prose-sm max-w-none dark:prose-invert" style="line-height:1.7">${item.answer}</div>`;
                panelRefs.current.set(i, el);
              } else {
                panelRefs.current.delete(i);
              }
            }}
          />
        </AccordionItem>
      ))}
    </Accordion>
  );
}
