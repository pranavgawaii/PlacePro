"use client";

import { buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import Link from "next/link";
import { useState, useRef } from "react";
import confetti from "canvas-confetti";
import NumberFlow from "@number-flow/react";

interface PricingPlan {
    name: string;
    price: string;
    yearlyPrice: string;
    period: string;
    features: string[];
    description: string;
    buttonText: string;
    href: string;
    isPopular: boolean;
}

interface PricingProps {
    plans: PricingPlan[];
    title?: string;
    description?: string;
}

export function Pricing({
    plans,
    title = "Simple, Transparent Pricing",
    description = "Choose the plan that works for you\nAll plans include access to our platform, lead generation tools, and dedicated support.",
}: PricingProps) {
    const [isMonthly, setIsMonthly] = useState(true);
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const switchRef = useRef<HTMLButtonElement>(null);

    const handleToggle = (checked: boolean) => {
        setIsMonthly(!checked);
        if (checked && switchRef.current) {
            const rect = switchRef.current.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            confetti({
                particleCount: 50,
                spread: 60,
                origin: {
                    x: x / window.innerWidth,
                    y: y / window.innerHeight,
                },
                colors: [
                    "#2563eb",
                    "#3b82f6",
                    "#60a5fa",
                    "#93c5fd",
                ],
                ticks: 200,
                gravity: 1.2,
                decay: 0.94,
                startVelocity: 30,
                shapes: ["circle"],
            });
        }
    };

    return (
        <div className="container py-20 px-4 mx-auto">
            <div className="text-center space-y-4 mb-16">
                <h2 className="text-4xl md:text-5xl lg:text-6xl tracking-tight leading-tight text-neutral-900" style={{ fontFamily: 'Georgia, serif', fontWeight: 400 }}>
                    {title}
                </h2>
                <p className="text-neutral-500 text-lg font-light max-w-2xl mx-auto">
                    {description}
                </p>
            </div>

            <div className="flex items-center justify-center mb-16 gap-6">
                <span className={cn("text-xs font-black tracking-widest uppercase transition-colors", isMonthly ? "text-neutral-900" : "text-neutral-400")}>Monthly</span>
                <Switch
                    ref={switchRef as any}
                    checked={!isMonthly}
                    onCheckedChange={handleToggle}
                    className="border-2 border-black"
                />
                <span className={cn("text-xs font-black tracking-widest uppercase transition-colors", !isMonthly ? "text-neutral-900" : "text-neutral-400")}>
                    Yearly <span className="text-blue-600 ml-1">(-20%)</span>
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {plans.map((plan, index) => (
                    <motion.div
                        key={index}
                        initial={{ y: 50, opacity: 0 }}
                        whileInView={
                            isDesktop
                                ? {
                                    y: plan.isPopular ? -20 : 0,
                                    opacity: 1,
                                    x: index === 2 ? -30 : index === 0 ? 30 : 0,
                                    scale: index === 0 || index === 2 ? 0.94 : 1.0,
                                }
                                : { y: 0, opacity: 1 }
                        }
                        viewport={{ once: true }}
                        transition={{
                            duration: 1.6,
                            type: "spring",
                            stiffness: 100,
                            damping: 30,
                            delay: 0.1 * index,
                            opacity: { duration: 0.5 },
                        }}
                        className={cn(
                            `rounded-2xl border-2 border-black p-8 bg-white text-center flex flex-col items-center relative transition-shadow hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)]`,
                            plan.isPopular ? "shadow-[8px_8px_0px_0px_rgba(37,99,235,1)] md:-translate-y-4 z-10" : "shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] z-0",
                            !plan.isPopular && "mt-5 md:mt-0"
                        )}
                    >
                        {plan.isPopular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white py-1.5 px-6 rounded-full border-2 border-black flex items-center gap-2 shadow-sm z-20">
                                <Star className="h-3.5 w-3.5 fill-current" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Most Popular</span>
                            </div>
                        )}
                        <div className="w-full flex-1 flex flex-col pt-4">
                            <p className="text-[11px] font-black text-neutral-400 tracking-[0.2em] uppercase mb-8">
                                {plan.name}
                            </p>

                            <div className="relative inline-block mx-auto mb-8">
                                {/* Coming Soon Overlay */}
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40 backdrop-blur-[1px] -rotate-3 border-2 border-dashed border-neutral-300 rounded-lg">
                                    <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-tighter shadow-sm">Coming Soon</span>
                                </div>

                                <div className="flex items-baseline justify-center gap-x-1 grayscale opacity-30">
                                    <span className="text-5xl font-black tracking-tighter text-neutral-900">
                                        <NumberFlow
                                            value={
                                                isMonthly ? Number(plan.price) : Number(plan.yearlyPrice)
                                            }
                                            format={{
                                                style: "currency",
                                                currency: "USD",
                                                minimumFractionDigits: 0,
                                                maximumFractionDigits: 0,
                                            }}
                                        />
                                    </span>
                                    <span className="text-sm font-bold tracking-tighter text-neutral-400">
                                        /{plan.period === "per month" ? "mo" : plan.period}
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs leading-5 text-neutral-500 mt-1">
                                {isMonthly ? "billed monthly" : "billed annually"}
                            </p>

                            <ul className="mt-8 space-y-4 flex-1">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <div className="mt-1 h-4 w-4 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                            <Check className="h-2.5 w-2.5 text-blue-600" />
                                        </div>
                                        <span className="text-left text-sm text-neutral-600">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-8 pt-8 border-t border-neutral-100">
                                <Link
                                    href={plan.href}
                                    className={cn(
                                        buttonVariants({
                                            variant: plan.isPopular ? "default" : "outline",
                                            size: "lg"
                                        }),
                                        "w-full font-black text-xs uppercase tracking-widest rounded-none border-2 border-black",
                                        plan.isPopular ? "bg-black hover:bg-blue-600 text-white" : "bg-white hover:bg-neutral-50 text-black shadow-none"
                                    )}
                                >
                                    {plan.buttonText}
                                </Link>
                                <p className="mt-4 text-[10px] font-bold text-neutral-400 uppercase tracking-tighter leading-tight">
                                    {plan.description}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
