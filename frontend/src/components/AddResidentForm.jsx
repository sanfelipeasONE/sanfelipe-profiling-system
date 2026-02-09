// src/components/AddResidentForm.jsx
import { useState, useEffect } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form'; // Added useWatch
import { Plus, Trash2 } from 'lucide-react';
import api from '../api';

export default function AddResidentForm({ onSuccess, onCancel }) {
  const { register, control, handleSubmit, reset, setValue } = useForm({
    defaultValues: {
      family_members: [],
      sector_ids: [],
      other_sector_details: "" // Field for the text input
    }
  });

  // Watch the sectors to see if "Others" is checked
  const selectedSectorIds = useWatch({ control, name: "sector_ids" }) || [];

  const [barangayOptions, setBarangayOptions] = useState([]);
  const [purokOptions, setPurokOptions] = useState([]);
  const [relationshipOptions, setRelationshipOptions] = useState([]);
  const [sectorOptions, setSectorOptions] = useState([]);
  
  // We need to know which ID belongs to "Others"
  const [othersSectorId, setOthersSectorId] = useState(null);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [barangayRes, purokRes, relationshipRes, sectorRes] = await Promise.all([
          api.get('/barangays/'),
          api.get('/puroks/'),
          api.get('/relationships/'),
          api.get('/sectors/')
        ]);
        
        setBarangayOptions(barangayRes.data);
        setPurokOptions(purokRes.data);
        setRelationshipOptions(relationshipRes.data);
        setSectorOptions(sectorRes.data);

        // Find and save the ID for "Others"
        const others = sectorRes.data.find(s => s.name === "Others");
        if (others) setOthersSectorId(others.id);

      } catch (error) {
        console.error("Error fetching options:", error);
      }
    };
    fetchOptions();
  }, []);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "family_members"
  });

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        sector_ids: data.sector_ids ? data.sector_ids.map(id => parseInt(id)) : []
      };

      await api.post('/residents/', payload);
      reset(); 
      onSuccess(); 
      alert("Resident added successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to save. Is the backend running?");
    }
  };

  // Helper to check if "Others" is currently selected
  // We convert to string because HTML values are strings
  const isOthersSelected = othersSectorId && selectedSectorIds.includes(String(othersSectorId));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      
      {/* SECTION 1: PERSONAL INFORMATION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input {...register("last_name", { required: true })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input {...register("first_name", { required: true })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Middle Name</label>
          <input {...register("middle_name")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
        </div>
      </div>

      {/* SECTION 2: ADDRESS & DEMOGRAPHICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Purok</label>
          <select {...register("purok", { required: true })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2">
            <option value="">Select Purok...</option>
            {purokOptions.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Barangay</label>
          <select {...register("barangay", { required: true })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2">
            <option value="">Select Barangay...</option>
            {barangayOptions.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Birthdate</label>
          <input type="date" {...register("birthdate", { required: true })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Sex</label>
          <select {...register("sex")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2">
            <option value="M">Male</option>
            <option value="F">Female</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Civil Status</label>
          <select {...register("civil_status")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2">
            <option value="Single">Single</option>
            <option value="Married">Married</option>
            <option value="Widowed">Widowed</option>
            <option value="Separated">Separated</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Contact No.</label>
          <input {...register("contact_no")} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
        </div>
      </div>

      {/* SECTION 3: SECTORS */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-bold text-gray-700 mb-2">Sectors</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {sectorOptions.map((sector) => (
            <label key={sector.id} className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                value={sector.id} 
                {...register("sector_ids")} 
              /> 
              <span>{sector.name}</span>
            </label>
          ))}
        </div>

        {/* DYNAMIC INPUT FOR "OTHERS" */}
        {isOthersSelected && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700">Please specify "Others":</label>
            <input 
              {...register("other_sector_details", { required: isOthersSelected })} 
              placeholder="e.g., Typhoon Victim, Scholarship Grantee"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 bg-yellow-50"
            />
          </div>
        )}
      </div>

      {/* SECTION 4: FAMILY MEMBERS */}
      <div className="border-t pt-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-bold text-gray-700">Family Members</h3>
          <button 
            type="button" 
            onClick={() => append({ last_name: '', first_name: '', relationship: '' })}
            className="text-sm text-blue-600 flex items-center hover:underline"
          >
            <Plus size={16} /> Add Member
          </button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-end mb-2 bg-gray-50 p-2 rounded">
             <div className="flex-1">
                <input {...register(`family_members.${index}.first_name`)} placeholder="First Name" className="w-full p-2 border rounded text-sm" />
             </div>
             <div className="flex-1">
                <input {...register(`family_members.${index}.last_name`)} placeholder="Last Name" className="w-full p-2 border rounded text-sm" />
             </div>
             <div className="w-32">
                <select {...register(`family_members.${index}.relationship`)} className="w-full p-2 border rounded text-sm">
                  <option value="">Relation...</option>
                  {relationshipOptions.map((rel) => (
                    <option key={rel.id} value={rel.name}>{rel.name}</option>
                  ))}
                </select>
             </div>
             <button type="button" onClick={() => remove(index)} className="text-red-500 p-2">
               <Trash2 size={16} />
             </button>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Save Resident
        </button>
      </div>
    </form>
  );
}