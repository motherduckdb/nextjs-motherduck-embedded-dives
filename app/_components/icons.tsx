type IconProps = { className?: string };

// MotherDuck footprint logo from motherduck.com
export function MotherDuckLogo({ className }: IconProps) {
  return (
    <svg className={className} width="28" height="21" viewBox="0 0 33 24" fill="none">
      <path d="M1.31048 16.547C1.31048 16.547 10.2894 22.927 10.8352 23.2451C11.3623 23.5632 12.1341 23.638 12.8117 23.3761C13.4894 23.1141 13.9976 22.5154 14.1482 21.9167C14.3176 21.318 16.3694 10.5412 16.3694 10.5412C16.3882 10.3915 16.4447 9.96116 16.2188 9.54955C15.8988 8.98826 15.1835 8.6889 14.5435 8.876C14.0353 9.02567 13.7717 9.39987 13.6964 9.53084C13.5835 9.73665 13.3764 10.0734 13 10.3728C12.7176 10.5973 12.4352 10.7283 12.3035 10.7844C11.1552 11.2521 9.87523 10.8592 9.14111 9.92374C8.68934 9.34374 7.87993 9.11922 7.16463 9.39987C6.44933 9.68052 6.03521 10.4102 6.09168 11.1399C6.22345 12.2999 5.56462 13.4599 4.39756 13.9276C3.77638 14.1709 3.11755 14.1709 2.53402 13.9838C2.40225 13.9463 1.93166 13.8341 1.46107 14.096C0.877536 14.3954 0.576358 15.1064 0.726947 15.7425C0.839889 16.1728 1.17871 16.4535 1.31048 16.547Z" fill="#FF9538" />
      <path d="M16.2751 2.57006C16.2751 2.57006 19.4752 13.085 19.701 13.6463C19.9269 14.2263 20.4916 14.7501 21.1881 14.9559C21.8846 15.1617 22.6563 14.9934 23.1458 14.6192C23.6352 14.245 31.8987 6.96686 31.8987 6.96686C32.0117 6.87331 32.3129 6.55525 32.3882 6.0875C32.4823 5.45137 32.087 4.77782 31.4846 4.53459C30.9952 4.34749 30.5434 4.47846 30.4117 4.53459C30.2046 4.62814 29.8281 4.75911 29.3576 4.77782C28.9811 4.79653 28.6987 4.72169 28.5481 4.68427C27.3623 4.34749 26.5717 3.26233 26.5717 2.08361C26.5528 1.35393 26.0634 0.680376 25.3293 0.474568C24.5764 0.268761 23.8046 0.586827 23.4093 1.20425C22.7881 2.21458 21.5646 2.71974 20.3599 2.38297C19.7199 2.19587 19.1928 1.80296 18.854 1.2978C18.7599 1.18554 18.4587 0.811344 17.9316 0.717795C17.2916 0.605537 16.5951 0.979732 16.3316 1.55974C16.1245 2.00877 16.2375 2.42039 16.2751 2.57006Z" fill="#FF9538" />
    </svg>
  );
}

export function ArrowUpRightIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17 17 7" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h9v9" />
    </svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 7.125-2.625-2.625" />
    </svg>
  );
}

export function SparklesIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
