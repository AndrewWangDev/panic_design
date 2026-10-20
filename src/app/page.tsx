import type { Metadata } from 'next';
import HomeClient from './HomeClient';

export const metadata: Metadata = {
  title: "Panic Design | AI-Driven Edge Chaos Gateway Console",
  description: "Zero-intrusion AIOps edge gateway. Automated chaos parameter generation and visualized physical routing trajectories.",
  openGraph: {
    title: "Panic Design | AI-Driven Edge Chaos Gateway Console",
    description: "Zero-intrusion AIOps edge gateway. Automated chaos parameter generation and visualized physical routing trajectories.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Panic Design | AI-Driven Edge Chaos Gateway Console",
    description: "Zero-intrusion AIOps edge gateway. Automated chaos parameter generation and visualized physical routing trajectories.",
  },
};

export default function Home() {
  return <HomeClient />;
}
