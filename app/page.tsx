"use client";

import { motion } from "framer-motion";
import { LandingNavbar } from "@/components/landing/Navbar";
import { LandingHero } from "@/components/landing/Hero";
import { InstitutionalArchitecture } from "@/components/landing/InstitutionalArchitecture";
import { InstitutionalProof } from "@/components/landing/InstitutionalProof";
import { InstitutionalFeatures } from "@/components/landing/InstitutionalFeatures";
import { ComparisonTable } from "@/components/landing/ComparisonTable";
import { Pricing } from "@/components/blocks/pricing";
import { LandingCTA } from "@/components/landing/CTA";
import { LandingFooter } from "@/components/landing/Footer";

export default function LandingPage() {
  const demoPlans = [
    {
      name: "STARTER",
      price: "50",
      yearlyPrice: "40",
      period: "per month",
      features: [
        "Up to 500 students",
        "Basic TPO Dashboard",
        "Job Posting System",
        "Standard Analytics",
        "Email Support",
      ],
      description: "Perfect for single departments or small colleges",
      buttonText: "Start Free Trial",
      href: "/signup",
      isPopular: false,
    },
    {
      name: "PROFESSIONAL",
      price: "99",
      yearlyPrice: "79",
      period: "per month",
      features: [
        "Up to 2000 students",
        "Advanced AI Resume Builder",
        "Automated Communication",
        "Priority TPO Support",
        "Student Performance Tracking",
        "Custom Branding",
      ],
      description: "Ideal for growing institutions and mid-size universities",
      buttonText: "Get Started",
      href: "/signup",
      isPopular: true,
    },
    {
      name: "ENTERPRISE",
      price: "299",
      yearlyPrice: "239",
      period: "per month",
      features: [
        "Unlimited students",
        "Custom Multi-campus Setup",
        "Dedicated Account Manager",
        "SSO & API Integration",
        "White-label Platform",
        "SLA Guarantee",
        "On-site Training",
      ],
      description: "For large universities with complex requirements",
      buttonText: "Contact Sales",
      href: "/contact",
      isPopular: false,
    },
  ];

  return (
    <div className="min-h-screen w-full bg-white flex justify-center selection:bg-black selection:text-white">
      <div className="flex w-full max-w-none sm:max-w-7xl border-x-0 sm:border-x-2 border-black relative text-black bg-white font-sans antialiased overflow-x-hidden">

        {/* Decorative Sidebars */}
        <div className="hidden lg:block w-[64px] border-r-2 border-black dot-matrix-pattern relative shrink-0" />

        <div className="flex-1 flex flex-col relative technical-grid bg-white">
          <LandingNavbar />

          <main className="flex-1 flex flex-col items-center relative z-10 px-0 sm:px-4">
            <LandingHero />
            <InstitutionalArchitecture />
          </main>

          <InstitutionalProof />
          <InstitutionalFeatures />
          <ComparisonTable />

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            id="pricing"
            className="py-20 bg-[#FAFAFA] border-b-2 border-black overflow-hidden"
          >
            <Pricing
              plans={demoPlans}
              title="Transparent Pricing"
              description="Simple, predictable pricing for institutions of all sizes."
            />
          </motion.section>

          <LandingCTA />
          <LandingFooter />
        </div>

        <div className="hidden lg:block w-[64px] border-l-2 border-black dot-matrix-pattern relative shrink-0" />
      </div>
    </div>
  );
}
