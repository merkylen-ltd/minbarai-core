'use client';

import React from 'react';
import { FaChartLine, FaUsers, FaClock, FaTrophy, FaEye, FaFileAlt } from 'react-icons/fa';
import ScrollArrow from '../ui/scroll-arrow';

interface ChoiceProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
}

const ChoiceCard: React.FC<ChoiceProps> = ({ title, description, icon, features }) => (
  <div className="card">
    <div className="flex items-center mb-3">
      <div className="p-2 bg-accent-500/20 rounded-lg mr-3">
        {icon}
      </div>
      <h3 className="font-display text-fluid-xl text-neutral-0 mb-4 leading-tight">{title}</h3>
    </div>
    <p className="text-fluid-sm text-neutral-50 leading-relaxed mb-3">{description}</p>
    <ul className="space-y-1">
      {features.map((feature, index) => (
        <li key={index} className="flex items-center text-fluid-sm text-neutral-50">
          <div className="w-1.5 h-1.5 bg-accent-400 rounded-full mr-2"></div>
          {feature}
        </li>
      ))}
    </ul>
  </div>
);

const WhyChooseUs: React.FC = () => {
  const choices: ChoiceProps[] = [
    {
      title: 'Advanced Analytics',
      description: 'Real-time insights with interactive charts and performance tracking.',
      icon: <FaChartLine className="text-accent-400" size={20} />,
      features: [
        'Real-time session tracking',
        'Interactive data visualization',
        'Performance trends analysis',
        'Custom exporting tools'
      ]
    },
    {
      title: 'Premium UX',
      description: 'Intuitive dashboards with smooth live sync and responsive design.',
      icon: <FaTrophy className="text-accent-400" size={20} />,
      features: [
        'Intuitive dashboards',
        'Customizable themes',
        'Live synchronization',
        'Responsive design'
      ]
    },
    {
      title: 'Flexible Pricing',
      description: 'Start free, scale with growth. No hidden fees or surprises.',
      icon: <FaUsers className="text-accent-400" size={20} />,
      features: [
        'Flexible monthly plans',
        'Pay-as-you-grow model',
        'Easy plan changes'
      ]
    },
    {
      title: 'Global Reliability',
      description: 'Auto-scaling cloud infrastructure with 99.9% uptime guarantee.',
      icon: <FaEye className="text-accent-400" size={20} />,
      features: [
        'Auto-scaling infrastructure',
        'Global CDN access',
        '99.9% uptime guarantee',
        'Real-time monitoring'
      ]
    },
    {
      title: 'Deep Insights',
      description: 'Visitor analysis, session metrics, and growth predictions.',
      icon: <FaFileAlt className="text-accent-400" size={20} />,
      features: [
        'Visitor behavior analysis',
        'Session engagement metrics',
        'Top content identification',
        'Growth trend predictions'
      ]
    },
    {
      title: 'Performance Monitoring',
      description: 'Track every metric with detailed performance dashboards.',
      icon: <FaClock className="text-accent-400" size={20} />,
      features: [
        'Real-time monitoring',
        'Session duration tracking',
        'Engagement calculations',
        'Custom dashboards'
      ]
    }
  ];

  return (
    <section className="why-choose-us section-min-height flex flex-col justify-center section-spacing gradient-section">
      <div className="container-custom">
        <h2 className="font-display text-fluid-2xl text-neutral-0 text-center mb-fluid-lg">
          Upcoming Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {choices.map((choice) => (
            <ChoiceCard key={choice.title} {...choice} />
          ))}
        </div>
        <ScrollArrow targetSelector=".social-proof" delay="1s" />
      </div>
    </section>
  );
};

export default WhyChooseUs;
