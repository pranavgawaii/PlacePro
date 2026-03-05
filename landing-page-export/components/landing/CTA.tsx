"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function LandingCTA() {
    return (
        <motion.section
            id="resources"
            className="py-32 px-8 bg-white border-b-2 border-black relative overflow-hidden"
        >
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                    backgroundImage:
                        "radial-gradient(circle, #000 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                }}
            ></div>
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="max-w-[1000px] mx-auto text-center relative z-10"
            >
                <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-6 text-black">
                    Transform <span className="italic font-light">Your Campus</span>
                </h2>
                <p className="text-gray-600 text-xl font-medium mb-10 max-w-2xl mx-auto">
                    Join 500+ top-tier institutions modernizing their campus recruitment
                    with PlacePro's infrastructure.
                </p>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="flex flex-col sm:flex-row justify-center items-center gap-6"
                >
                    <Link
                        className="bg-black text-white px-8 py-4 border-2 border-black text-base font-bold hover:bg-black transition-all flex items-center gap-2 uppercase tracking-wide"
                        href="/signup"
                    >
                        Start 14-day trial
                        <span className="material-symbols-outlined text-lg">
                            arrow_forward
                        </span>
                    </Link>
                    <Link
                        className="px-8 py-4 border-b-2 border-black text-base font-bold text-black hover:text-blue-600 hover:border-blue-600 transition-all flex items-center gap-2 uppercase tracking-wide"
                        href="/contact"
                    >
                        Contact Sales
                    </Link>
                </motion.div>
            </motion.div>
        </motion.section>
    );
}
