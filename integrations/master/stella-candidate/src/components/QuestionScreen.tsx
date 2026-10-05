import { optionArtwork } from './question-artwork'
import type { Product } from '../types/prototype'
import { BackButton } from './BackButton'
import { ProductMark } from './ProductMark'
import { RingTag } from './RingTag'

interface QuestionOption<T extends string> {
  id: T
  label: string
}

interface QuestionScreenProps<T extends string> {
  product: Product
  prompt: string
  options: Array<QuestionOption<T>>
  onSelect: (id: T) => void
  onBack: () => void
  step?: number
  total?: number
}

export function QuestionScreen<T extends string>({
  product,
  prompt,
  options,
  onSelect,
  onBack,
  step = 1,
  total = 2,
}: QuestionScreenProps<T>) {
  return (
    <section className="screen screen--question" aria-labelledby="screen-title">
      <ProductMark product={product} />
      <div className="question-heading" data-lc-influence="shadow" data-lc-strength="0.5">
        <p className="screen-step">Вопрос {step} из {total}</p>
        <h1 id="screen-title">{prompt}</h1>
      </div>
      <div className="options">
        {options.map((option, index) => (
          <RingTag tone={product === 'max' ? index % 2 ? 'cyan' : 'violet' : 'blue'}
            className={`option-button ${product === 'vk-video' && optionArtwork[option.id] ? 'option-button--illustrated' : ''}`}
            key={option.id}
            onClick={() => onSelect(option.id)}
          >
            {product === 'vk-video' && optionArtwork[option.id] && <img className="option-artwork" src={optionArtwork[option.id]} alt="" aria-hidden="true" />}
            <span>{option.label}</span>
          </RingTag>
        ))}
      </div>
      <BackButton product={product} onClick={onBack} />
    </section>
  )
}
