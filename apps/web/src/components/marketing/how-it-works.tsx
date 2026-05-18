'use client';

import { motion } from 'framer-motion';

const steps = [
  {
    number: '01',
    title: 'Crie sua conta',
    description: 'Email e senha. Em 30 segundos você está dentro.',
  },
  {
    number: '02',
    title: 'Nomeie seu estúdio',
    description: 'O nome vira sua URL pública: photogrid.store/seu-nome.',
  },
  {
    number: '03',
    title: 'Suba suas galerias',
    description: 'Drag & drop. Organize por turma, evento ou cliente.',
  },
  {
    number: '04',
    title: 'Compartilhe e venda',
    description: 'Envie o link. Seus clientes escolhem, pagam e baixam.',
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" className="relative bg-ink py-24 text-white sm:py-32">
      <div className="container-app">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            Quatro passos. Zero fricção.
          </h2>
          <p className="mt-4 text-pretty text-white/60">
            Pensado para quem quer fotografar — não administrar planilhas.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, idx) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.4, delay: idx * 0.06 }}
              className="relative flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-6"
            >
              <span className="font-mono text-sm font-medium text-brand-400">
                {step.number}
              </span>
              <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="text-sm text-white/60">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
