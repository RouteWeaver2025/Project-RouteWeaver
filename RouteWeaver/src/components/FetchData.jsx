import React, { useEffect } from 'react';
import { fetchData } from './services/api'; // Adjust path if needed

const DataComponent = () => {
  useEffect(() => {
    fetchData();
  }, []);

  return <div>Data is being fetched...</div>;
};

export default DataComponent;
