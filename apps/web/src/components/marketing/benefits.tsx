'use client';

import { motion } from 'framer-motion';
import { Camera, Link2, ShieldCheck, Sparkles, Store, Zap } from 'lucide-react';

const benefits = [
  {
    icon: Camera,
    title: 'Galerias organizadas',
    description:
      'Tudo no lugar certo: turmas, eventos, datas. Encontre qualquer foto em segundos.',
  },
  {
    icon: Link2,
    title: 'Compartilhamento por link',
    description:
      'Envie um link único para cada cliente. Sem WhatsApp lotado, sem confusão.',
  },
  {
    icon: Store,
    title: 'Sua loja própria',
    description:
      'photogrid.store/seu-nome. Uma vitrine profissional que vende por você.',
  },
  {
    icon: Zap,
    title: 'Upload em massa',
    description:
      'Suba milhares de fotos com drag & drop. Thumbnails e compressão automáticas.',
  },
  {
    icon: ShieldCheck,
    title: 'Acesso protegido',
    description:
      'Cada cliente vê só o que é dele. Privacidade garantida em todos os pontos.',
  },
  {
    icon: Sparkles,
    title: 'UX minimalista',
    description:
      'Feito para quem não é técnico. Fluxo simples, poucos cliques, zero gambiarra.',
  },
];

export function Benefits() {
  return (
    <section id="beneficios" className="relative py-24 sm:py-32">
      <div className="container-app">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Tudo que faltava para entregar fotos como uma startup.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Construído do zero para fotógrafos que querem deixar o caderno e a planilha
            para trás.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, idx) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.35, delay: idx * 0.04 }}
              className="group flex flex-col gap-3 bg-card p-8 transition-colors hover:bg-muted/40"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                <benefit.icon className="size-5" />
              </span>
              <h3 className="text-base font-semibold tracking-tight text-ink">
                {benefit.title}
              </h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
