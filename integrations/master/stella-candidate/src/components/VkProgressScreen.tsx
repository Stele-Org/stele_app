import { ProductMark } from './ProductMark'

/** Informational fallback for scenario steps with no tags. */
export function VkProgressScreen({ title, description, showProductMark = true }: { title: string; description?: string; showProductMark?: boolean }) {
  return (
    <section className="screen screen--vk-progress" aria-label="Метаданные ответа" role="status">
      {showProductMark && <ProductMark product="vk-video" />}
      <div className="progress-copy" data-lc-influence="shadow" data-lc-strength="0.35">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </section>
  )
}
