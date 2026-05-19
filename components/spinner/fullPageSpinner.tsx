const FullPageSpinner = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/80">
      <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
  );
};

export default FullPageSpinner;
