"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function LandingCTA() {
    return (
        <motion.section
            id="resources"
            className="relative overflow-hidden border-b-2 border-black bg-white px-4 py-24 sm:px-8 sm:py-32"
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
                className="relative z-10 mx-auto max-w-[1000px] text-center"
            >
                <h2 className="mb-6 font-serif text-3xl text-black sm:text-4xl md:text-5xl lg:text-6xl">
                    Transform <span className="italic font-light">Your Campus</span>
                </h2>
                <p className="mx-auto mb-10 max-w-2xl text-base font-medium text-gray-600 sm:text-xl">
                    Join 500+ top-tier institutions modernizing their campus recruitment
                    with PlacePro's infrastructure.
                </p>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                    className="flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center sm:gap-6"
                >
                    <Link
                        className="flex items-center justify-center gap-2 border-2 border-black bg-black px-8 py-4 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-black sm:text-base"
                        href="/signup"
                    >
                        Start 14-day trial
                        <span className="material-symbols-outlined text-lg">
                            arrow_forward
                        </span>
                    </Link>
                    <Link
                        className="flex items-center justify-center gap-2 border-b-2 border-black px-8 py-4 text-sm font-bold uppercase tracking-wide text-black transition-all hover:border-blue-600 hover:text-blue-600 sm:text-base"
                        href="/contact"
                    >
                        Contact Sales
                    </Link>
                </motion.div>
            </motion.div>
        </motion.section>
    );
}
