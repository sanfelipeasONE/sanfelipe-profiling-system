import { useState } from 'react';
import ResidentList from './components/ResidentList';
import Modal from './components/modal';
import AddResidentForm from './components/AddResidentForm';
import { PlusCircle } from 'lucide-react';

function App() {
  const [isModalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Used to trigger list refresh

  const handleSuccess = () => {
    setModalOpen(false);
    setRefreshKey(old => old + 1); // This forces ResidentList to re-fetch data
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <header className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">San Felipe, Zambales</h1>
            <p className="text-gray-500 text-sm">Residential Management System</p>
          </div>
          <button 
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition shadow-sm"
          >
            <PlusCircle size={20} />
            <span>Add Resident</span>
          </button>
        </header>

        {/* Main Content */}
        <main>
          {/* We pass 'key' so React re-renders the list when we add a new person */}
          <ResidentList key={refreshKey} />
        </main>

        {/* The Modal */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setModalOpen(false)}
          title="New Resident Registration"
        >
          <AddResidentForm 
            onSuccess={handleSuccess} 
            onCancel={() => setModalOpen(false)} 
          />
        </Modal>

      </div>
    </div>
  )
}

export default App