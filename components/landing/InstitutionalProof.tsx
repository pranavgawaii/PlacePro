"use client";

import { motion } from "framer-motion";

export function InstitutionalProof() {
    const institutions = [
        { icon: "school", name: "IIT Bombay" },
        { icon: "menu_book", name: "BITS Pilani" },
        { icon: "history_edu", name: "NIT Trichy" },
        { icon: "science", name: "IIIT Hyderabad" },
        { icon: "architecture", name: "VIT Vellore" }
    ];

    return (
        <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="py-10 bg-white border-y-2 border-black relative"
        >
            <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
                <p className="text-center text-xs font-mono font-bold text-gray-400 mb-8 uppercase tracking-[0.3em]">
                    Institutional Registry & Partners
                </p>
                <div className="flex flex-wrap justify-center gap-x-8 gap-y-6 opacity-100 sm:gap-x-16 sm:gap-y-8">
                    {institutions.map((inst, i) => (
                        <motion.div
                            key={inst.name}
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="flex items-center gap-2 text-base font-black text-black transition-colors cursor-pointer hover:text-blue-600 sm:text-xl"
                        >
                            <span className="material-symbols-outlined">{inst.icon}</span> {inst.name}
                        </motion.div>
                    ))}
                </div>
            </div>
        </motion.section>
    );
}
