import { GlassCard } from "../../components/glass/GlassCard";

interface FeaturePlaceholderProps {
  title: string;
  stage: string;
  description: string;
}

/** feature 占位页：S 阶段推进过程中逐个替换为真实实现 */
export function FeaturePlaceholder({ title, stage, description }: FeaturePlaceholderProps) {
  return (
    <GlassCard hoverable className="p-8">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1 text-xs opacity-50">{stage}</p>
      <p className="mt-4 text-sm leading-relaxed opacity-70">{description}</p>
    </GlassCard>
  );
}
