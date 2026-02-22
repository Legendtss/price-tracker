import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TrackedProducts from '../components/TrackedProducts';

function TrackingPage() {
  const navigate = useNavigate();

  const handleViewHistory = (productId) => {
    navigate(`/history/${productId}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <TrackedProducts onViewHistory={handleViewHistory} />
    </div>
  );
}

export default TrackingPage;
