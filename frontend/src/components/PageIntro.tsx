interface Props {
  kicker: string
  title: string
  description: string
}

export function PageIntro({ kicker, title, description }: Props) {
  return (
    <header className="page-intro">
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  )
}
