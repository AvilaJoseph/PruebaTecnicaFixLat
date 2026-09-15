interface PagePlaceholderProps {
  title: string;
  description: string;
}

/** Contenido provisional de una sección cuya funcionalidad aún no está implementada. */
export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="card">
      <h1>{title}</h1>
      <p className="muted">{description}</p>
    </section>
  );
}
