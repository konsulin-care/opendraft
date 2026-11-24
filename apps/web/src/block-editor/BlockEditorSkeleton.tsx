/**
 * Layout-stable placeholder shown while the lazy block-editor chunk loads:
 * four pulsing lines inside the shared reading column so the reading surface
 * does not jump when the real blocks replace it.
 *
 * @returns The skeleton placeholder.
 */
export function BlockEditorSkeleton() {
  const widths = ['w-3/4', 'w-full', 'w-5/6', 'w-1/2'];
  return (
    <div
      data-testid="block-editor-skeleton"
      aria-hidden="true"
      className="reading-column animate-pulse motion-reduce:animate-none py-6"
    >
      {widths.map((width) => (
        <div key={width} className={`h-4 rounded bg-neutral-200 ${width} mb-4 last:mb-0`} />
      ))}
    </div>
  );
}
