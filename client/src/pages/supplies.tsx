import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Search, Plus, Edit, Trash2, Upload, X, Save, AlertTriangle, LayoutGrid, Table as TableIcon, Sparkles, Palette, Moon, Sun, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout";

interface Supply {
  id: number;
  name: string;
  hexColor: string;
  pieceSize: string;
  partNumber?: string;
  description?: string;
  availableInCatalog?: boolean;
  retailPrice?: number;
  imageUrl?: string | null;
  texture: string | null;
  createdAt: string;
  updatedAt: string;
  // For backward compatibility with existing data
  location?: {
    id: number;
    name: string;
  } | null;
  defaultVendor?: string;
  defaultVendorPrice?: number;
  // Aggregated inventory summaries from server
  totalOnHand?: number;
  totalAllocated?: number;
  totalAvailable?: number;
  locationsSummary?: {
    locationId: number;
    locationName: string;
    categoryId: number | null;
    onHandQuantity: number;
    allocatedQuantity: number;
    availableQuantity: number;
    minimumQuantity: number;
    orderGroupSize: number;
  }[];
}

interface Location {
  id: number;
  name: string;
}

interface LocationCategory {
  id: number;
  name: string;
  description?: string | null;
}

interface Vendor {
  id: number;
  name: string;
  company: string;
  contact_info?: string;
  createdAt: string;
  updatedAt: string;
}

// Enhanced TextureSwatch component with black letter fallback
interface TextureSwatchProps {
  texture: string | null;
  hexColor: string;
  name: string;
  size?: "sm" | "md" | "lg";
  isDarkMode?: boolean;
}

const TextureSwatch = ({ texture, hexColor, name, size = "md", isDarkMode = false }: TextureSwatchProps) => {
  const sizeClasses: Record<string, string> = {
    sm: "w-10 h-10",
    md: "w-14 h-14", 
    lg: "w-20 h-20"
  };

  const textSizes: Record<string, string> = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg"
  };

  const textureUrl = texture && texture.startsWith('/uploads/') 
    ? texture 
    : texture && !texture.startsWith('http') && texture !== ""
    ? `/uploads/${texture}` 
    : texture;

  const firstLetter = name ? name.charAt(0).toUpperCase() : "?";
  
  // Generate a vibrant gradient based on the hex color
  const generateGradient = (color: string) => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    // Create a lighter version for gradient
    const lighten = (val: number) => Math.min(255, val + 40);
    const darken = (val: number) => Math.max(0, val - 20);
    
    const lightColor = `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`;
    const darkColor = `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
    
    return `linear-gradient(135deg, ${lightColor} 0%, ${color} 50%, ${darkColor} 100%)`;
  };

  const borderClass = isDarkMode ? "border-gray-600" : "border-white";
  const shineClass = isDarkMode 
    ? "bg-gradient-to-r from-transparent via-gray-300 to-transparent" 
    : "bg-gradient-to-r from-transparent via-white to-transparent";

  return (
    <div className={`${sizeClasses[size]} rounded-xl border-3 ${borderClass} shadow-lg overflow-hidden flex-shrink-0 relative group transition-all duration-300 hover:scale-105 hover:shadow-xl`}>
      {textureUrl && textureUrl !== "" ? (
        <>
          <img 
            src={textureUrl} 
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const nextSibling = target.nextSibling as HTMLElement;
              if (nextSibling) {
                nextSibling.style.display = 'flex';
              }
            }}
            // style={{'backgroundColor':'black'}}
          />
          <div 
            className="w-full h-full flex items-center justify-center font-bold text-black shadow-inner"
            style={{ 
              background: generateGradient(hexColor),
              display: 'none'
            }}
            title={name}
          >
            <span className={`${textSizes[size]} font-extrabold drop-shadow-lg`}>
              {firstLetter}
            </span>
          </div>
        </>
      ) : (
        <div 
          className="w-full h-full flex items-center justify-center font-bold text-black shadow-inner"
          style={{ 
            background: generateGradient(hexColor)
          }}
          title={name}
        >
          <span className={`${textSizes[size]} font-extrabold drop-shadow-lg`}>
            {firstLetter}
          </span>
        </div>
      )}
      
      {/* Shine effect */}
      <div className={`absolute inset-0 ${shineClass} opacity-0 group-hover:opacity-20 transform -skew-x-12 transition-all duration-700 group-hover:translate-x-full`}></div>
    </div>
  );
};

export default function Supplies() {
  const [currentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "card" or "table"
  const [isDarkMode, setIsDarkMode] = useState(false); // Dark mode state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'edit' | 'view'>('edit');
  const [viewSupply, setViewSupply] = useState<Supply | null>(null);
  const [locationMetrics, setLocationMetrics] = useState<Array<{locationId:number;locationName:string;onHandQuantity:number;allocatedQuantity:number;availableQuantity:number;}>>([]);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [supplyToDelete, setSupplyToDelete] = useState<Supply | null>(null);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [newLocationName, setNewLocationName] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<number | 'all'>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states for add/edit supply
  const [supplyForm, setSupplyForm] = useState({
    name: "",
    hexColor: "#6366f1",
    pieceSize: "sheet",
    partNumber: "",
    description: "",
    availableInCatalog: false,
    retailPrice: 0,
    imageUrl: null as string | null,
    texture: null as string | null,
    // Vendor relationships
    vendors: [
      {
        id: 0,
        vendorId: undefined as number | undefined,
        vendorPartNumber: "Retail Price",
        price: 0,
        isPreferred: true
      }
    ],
    // Location relationships
    locations: [
      {
        id: 0,
        locationId: undefined as number | undefined,
        onHandQuantity: 0,
        minimumQuantity: 0,
        orderGroupSize: 1,
      }
    ]
  });

  // Form states for edit supply
  const [editSupplyForm, setEditSupplyForm] = useState({
    name: "",
    hexColor: "#6366f1",
    pieceSize: "sheet",
    partNumber: "",
    description: "",
    availableInCatalog: false,
    retailPrice: 0,
    imageUrl: null as string | null,
    texture: null as string | null,
    // Vendor relationships
    vendors: [
      {
        id: 0,
        vendorId: undefined as number | undefined,
        vendorPartNumber: "Retail Price",
        price: 0,
        isPreferred: true
      }
    ],
    // Location relationships
    locations: [
      {
        id: 0,
        locationId: undefined as number | undefined,
        onHandQuantity: 0,
        minimumQuantity: 0,
        orderGroupSize: 1,
      }
    ]
  });

  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('darkMode');
    if (savedTheme) {
      setIsDarkMode(JSON.parse(savedTheme));
    }
  }, []);

  // Save dark mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Fetch supplies
  const { data: supplies = [], isLoading: suppliesLoading } = useQuery({
    queryKey: ["supplies", searchTerm],
    queryFn: async () => {
      const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const response = await fetch(`/api/supplies${params}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch supplies");
      return response.json();
    }
  });

  // Fetch locations
  const { data: locations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const response = await fetch("/api/locations", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch locations");
      return response.json();
    }
  });

  // Fetch location categories for filtering
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["location-categories"],
    queryFn: async () => {
      const response = await fetch("/api/location-categories", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    }
  });

  // Fetch vendors
  const { data: vendors = [], isLoading: vendorsLoading, error: vendorsError } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const response = await fetch("/api/vendors", {
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to fetch vendors");
      return response.json();
    }
  });

  // Create supply mutation
  const createSupplyMutation = useMutation({
    mutationFn: async (supplyData: any) => {
      const response = await fetch("/api/supplies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(supplyData)
      });
      if (!response.ok) throw new Error("Failed to create supply");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
      setShowAddDialog(false);
      resetSupplyForm();
      toast({
        title: "✨ Success",
        description: "Supply created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Update supply mutation
  const updateSupplyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      console.log('Updating supply with ID:', id, 'Data:', data);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
      const response = await fetch(`/api/supplies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        console.log('Update response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Update error:', errorText);
          throw new Error(`Failed to update supply: ${response.status} ${errorText}`);
        }
      return response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timed out after 10 seconds');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
      setShowEditDialog(false);
      setEditingSupply(null);
      resetEditSupplyForm();
      toast({
        title: "✨ Success",
        description: "Supply updated successfully",
      });
    },
    onError: (error) => {
      console.error('Update supply mutation error:', error);
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Delete supply mutation
  const deleteSupplyMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/supplies/${id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) {
        let msg = "Failed to delete supply";
        try { const j = await response.json(); if (j?.message) msg = j.message; } catch {}
        throw new Error(msg);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplies"] });
      setSupplyToDelete(null);
      toast({
        title: "✨ Success",
        description: "Supply deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error("Failed to create location");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      setShowLocationDialog(false);
      setNewLocationName("");
      toast({
        title: "✨ Success",
        description: "Location created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Upload texture mutation
  const uploadTextureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("texture", file);
      const response = await fetch("/api/upload-texture", {
        method: "POST",
        credentials: "include",
        body: formData
      });
      if (!response.ok) throw new Error("Failed to upload texture");
      const result = await response.json();
      return result.filename;
    },
    onSuccess: (filename) => {
      setSupplyForm(prev => ({ ...prev, texture: filename }));
      setEditSupplyForm(prev => ({ ...prev, texture: filename }));
      toast({
        title: "🖼️ Success",
        description: "Texture uploaded successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const resetSupplyForm = () => {
    setSupplyForm({
      name: "",
      hexColor: "#6366f1",
      pieceSize: "sheet",
      partNumber: "",
      description: "",
      availableInCatalog: false,
      retailPrice: 0,
      imageUrl: null,
      texture: null,
      vendors: [
        {
          id: 0,
          vendorId: undefined,
          vendorPartNumber: "Retail Price",
          price: 0,
          isPreferred: true
        }
      ],
      locations: [
        {
          id: 0,
          locationId: undefined,
          onHandQuantity: 0,
          minimumQuantity: 0,
          orderGroupSize: 1,
        }
      ]
    });
  };

  const resetEditSupplyForm = () => {
    setEditSupplyForm({
      name: "",
      hexColor: "#6366f1",
      pieceSize: "sheet",
      partNumber: "",
      description: "",
      availableInCatalog: false,
      retailPrice: 0,
      imageUrl: null,
      texture: null,
      vendors: [
        {
          id: 0,
          vendorId: undefined,
          vendorPartNumber: "Retail Price",
          price: 0,
          isPreferred: true
        }
      ],
      locations: [
        {
          id: 0,
          locationId: undefined,
          onHandQuantity: 0,
          minimumQuantity: 0,
          orderGroupSize: 1,
        }
      ]
    });
  };

  const handleAddSupply = () => {
    console.log('Submitting supply form:', supplyForm);
    
    // Prepare the supply data with vendor and location relationships
    const supplyData = {
      // Basic supply data
      name: supplyForm.name,
      hexColor: supplyForm.hexColor,
      pieceSize: supplyForm.pieceSize,
      partNumber: supplyForm.partNumber,
      description: supplyForm.description,
      availableInCatalog: supplyForm.availableInCatalog,
      retailPrice: supplyForm.retailPrice,
      imageUrl: supplyForm.imageUrl,
      texture: supplyForm.texture,
      
      // Vendor relationships (include any row with a selected vendor)
      vendors: supplyForm.vendors.filter(v => v.vendorId && v.vendorId > 0),
      
      // Location relationships (include any row with a selected location)
      locations: supplyForm.locations.filter(l => l.locationId && l.locationId > 0)
    };
    
    createSupplyMutation.mutate(supplyData);
  };

  const handleEditSupply = () => {
    if (!editingSupply) return;
    
    console.log('Submitting edit supply form:', editSupplyForm);
    
    // Prepare the supply data with vendor and location relationships
    const supplyData = {
      // Basic supply data
      name: editSupplyForm.name,
      hexColor: editSupplyForm.hexColor,
      pieceSize: editSupplyForm.pieceSize,
      partNumber: editSupplyForm.partNumber,
      description: editSupplyForm.description,
      availableInCatalog: editSupplyForm.availableInCatalog,
      retailPrice: editSupplyForm.retailPrice,
      imageUrl: editSupplyForm.imageUrl,
      texture: editSupplyForm.texture,
      
      // Vendor relationships (include any row with a selected vendor)
      vendors: editSupplyForm.vendors.filter(v => v.vendorId && v.vendorId > 0),
      
      // Location relationships (include any row with a selected location)
      locations: editSupplyForm.locations.filter(l => l.locationId && l.locationId > 0)
    };
    
    console.log('Prepared supply data for update:', supplyData);
    console.log('Editing supply ID:', editingSupply.id);
    console.log('Raw vendors before filtering:', editSupplyForm.vendors);
    console.log('Raw locations before filtering:', editSupplyForm.locations);
    console.log('Filtered vendors:', supplyData.vendors);
    console.log('Filtered locations:', supplyData.locations);
    
    updateSupplyMutation.mutate({
      id: editingSupply.id,
      data: supplyData
    });
  };

  const handleDeleteSupply = () => {
    if (!supplyToDelete) return;
    deleteSupplyMutation.mutate(supplyToDelete.id);
  };

  const handleCreateLocation = () => {
    if (!newLocationName.trim()) return;
    createLocationMutation.mutate(newLocationName.trim());
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadTextureMutation.mutate(file);
    }
  };

  const clearTexture = (isEdit = false) => {
    if (isEdit) {
      setEditSupplyForm(prev => ({ ...prev, texture: null }));
    } else {
      setSupplyForm(prev => ({ ...prev, texture: null }));
    }
  };

  // Vendor management functions
  const addVendor = (isEdit = false) => {
    const newVendor = {
      id: Date.now(),
      vendorId: undefined as number | undefined,
      vendorPartNumber: "",
      price: 0,
      isPreferred: false
    };
    
    if (isEdit) {
      setEditSupplyForm(prev => ({
        ...prev,
        vendors: [...prev.vendors, newVendor]
      }));
    } else {
      setSupplyForm(prev => ({
        ...prev,
        vendors: [...prev.vendors, newVendor]
      }));
    }
  };

  const removeVendor = (vendorId: number, isEdit = false) => {
    if (isEdit) {
      setEditSupplyForm(prev => ({
        ...prev,
        vendors: prev.vendors.filter(v => v.id !== vendorId)
      }));
    } else {
      setSupplyForm(prev => ({
        ...prev,
        vendors: prev.vendors.filter(v => v.id !== vendorId)
      }));
    }
  };

  const updateVendor = (vendorId: number, field: string, value: any, isEdit = false) => {
    console.log(`Updating vendor ${vendorId}, field: ${field}, value:`, value, 'isEdit:', isEdit);
    if (isEdit) {
      setEditSupplyForm(prev => {
        const updated = {
          ...prev,
          vendors: prev.vendors.map(v => 
            v.id === vendorId ? { ...v, [field]: value } : v
          )
        };
        console.log('Updated editSupplyForm vendors:', updated.vendors);
        return updated;
      });
    } else {
      setSupplyForm(prev => {
        const updated = {
          ...prev,
          vendors: prev.vendors.map(v => 
            v.id === vendorId ? { ...v, [field]: value } : v
          )
        };
        console.log('Updated supplyForm vendors:', updated.vendors);
        return updated;
      });
    }
  };

  // Location management functions
  const addLocation = (isEdit = false) => {
    const newLocation = {
      id: Date.now(),
      locationId: undefined as number | undefined,
      onHandQuantity: 0,
      minimumQuantity: 0,
      orderGroupSize: 1,
    };
    
    if (isEdit) {
      setEditSupplyForm(prev => ({
        ...prev,
        locations: [...prev.locations, newLocation]
      }));
    } else {
      setSupplyForm(prev => ({
        ...prev,
        locations: [...prev.locations, newLocation]
      }));
    }
  };

  const removeLocation = (locationId: number, isEdit = false) => {
    if (isEdit) {
      setEditSupplyForm(prev => ({
        ...prev,
        locations: prev.locations.filter(l => l.id !== locationId)
      }));
    } else {
      setSupplyForm(prev => ({
        ...prev,
        locations: prev.locations.filter(l => l.id !== locationId)
      }));
    }
  };

  const updateLocation = (locationId: number, field: string, value: any, isEdit = false) => {
    console.log(`Updating location ${locationId}, field: ${field}, value:`, value, 'isEdit:', isEdit);
    if (isEdit) {
      setEditSupplyForm(prev => {
        const updated = {
          ...prev,
          locations: prev.locations.map(l => 
            l.id === locationId ? { ...l, [field]: value } : l
          )
        };
        console.log('Updated editSupplyForm locations:', updated.locations);
        return updated;
      });
    } else {
      setSupplyForm(prev => {
        const updated = {
          ...prev,
          locations: prev.locations.map(l => 
            l.id === locationId ? { ...l, [field]: value } : l
          )
        };
        console.log('Updated supplyForm locations:', updated.locations);
        return updated;
      });
    }
  };

  const openEditDialog = async (supply: Supply) => {
    try {
      setDialogMode('edit');
      // Fetch the complete supply data with vendor and location relationships
      const response = await fetch(`/api/supplies/${supply.id}`, {
        credentials: "include"
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch supply data');
      }
      
      const supplyData = await response.json();
      console.log('Fetched supply data for editing:', supplyData);
      console.log('Vendors from API:', supplyData.vendors);
      console.log('Locations from API:', supplyData.locations);
      
      const mappedVendors = supplyData.vendors && supplyData.vendors.length > 0 
        ? supplyData.vendors.map((v: any) => ({
            id: v.id,
            vendorId: v.vendorId,
            vendorPartNumber: v.vendorPartNumber,
            price: v.price,
            isPreferred: v.isPreferred
          }))
        : [
            {
              id: 0,
              vendorId: undefined,
              vendorPartNumber: "Retail Price",
              price: 0,
              isPreferred: true
            }
          ];

      const mappedLocations = supplyData.locations && supplyData.locations.length > 0
        ? supplyData.locations.map((l: any) => ({
            id: l.id,
            locationId: l.locationId,
            onHandQuantity: l.onHandQuantity || 0,
            minimumQuantity: l.minimumQuantity || 0,
            orderGroupSize: l.orderGroupSize || 1,
          }))
        : [
            {
              id: 0,
              locationId: undefined,
              onHandQuantity: 0,
              minimumQuantity: 0,
              orderGroupSize: 1,
            }
          ];

      console.log('Mapped vendors for form:', mappedVendors);
      console.log('Mapped locations for form:', mappedLocations);

      setEditingSupply(supply);
      setEditSupplyForm({
        name: supplyData.name,
        hexColor: supplyData.hexColor,
        pieceSize: supplyData.pieceSize,
        partNumber: supplyData.partNumber || "",
        description: supplyData.description || "",
        availableInCatalog: supplyData.availableInCatalog || false,
        retailPrice: supplyData.retailPrice || 0,
        imageUrl: supplyData.imageUrl || null,
        texture: supplyData.texture,
        vendors: mappedVendors,
        locations: mappedLocations
      });
      // Load location metrics for description analytics in edit mode
      try {
        const metricsRes = await fetch(`/api/supplies/${supply.id}/location-metrics`, { credentials: 'include' });
        const metrics = await metricsRes.json();
        setLocationMetrics(metrics || []);
      } catch {
        setLocationMetrics([]);
      }
      setShowEditDialog(true);
    } catch (error) {
      console.error('Error fetching supply data for editing:', error);
      // Fallback to basic data if fetch fails
    setEditingSupply(supply);
    setEditSupplyForm({
      name: supply.name,
      hexColor: supply.hexColor,
      pieceSize: supply.pieceSize,
        partNumber: supply.partNumber || "",
        description: supply.description || "",
        availableInCatalog: supply.availableInCatalog || false,
        retailPrice: supply.retailPrice || 0,
        imageUrl: supply.imageUrl || null,
        texture: supply.texture,
        vendors: [
          {
            id: 0,
            vendorId: undefined,
            vendorPartNumber: "Retail Price",
            price: 0,
            isPreferred: true
          }
        ],
        locations: [
          {
            id: 0,
            locationId: undefined,
            onHandQuantity: 0,
            minimumQuantity: 0,
            orderGroupSize: 1,
          }
        ]
    });
    setShowEditDialog(true);
    }
  };

  const filteredSupplies = supplies.filter((supply: Supply) => {
    const matchesSearch = supply.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all'
      ? true
      : (supply.locationsSummary || []).some(ls => ls.categoryId === categoryFilter);
    const matchesLocation = locationFilter === 'all'
      ? true
      : (supply.locationsSummary || []).some(ls => ls.locationId === locationFilter);
    return matchesSearch && matchesCategory && matchesLocation;
  });

  const formatPrice = (priceInCents: number | null | undefined) => {
    if (!priceInCents) return "—";
    return `$${(priceInCents / 100).toFixed(2)}`;
  };

  // Theme classes
  const themeClasses = {
    background: isDarkMode ? "bg-gray-900" : "bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100",
    header: isDarkMode ? "bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600" : "bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600",
    card: isDarkMode 
      ? "bg-gradient-to-br from-gray-800 via-gray-800 to-gray-700 hover:from-gray-700 hover:via-gray-800 hover:to-gray-600" 
      : "bg-gradient-to-br from-white via-white to-gray-50 hover:from-purple-50 hover:via-white hover:to-indigo-50",
    searchBar: isDarkMode ? "bg-gray-800/80" : "bg-white/80",
    text: isDarkMode ? "text-white" : "text-gray-900",
    textSecondary: isDarkMode ? "text-gray-300" : "text-gray-600",
    border: isDarkMode ? "border-gray-600" : "border-gray-200",
    table: isDarkMode ? "bg-gray-800" : "bg-white",
    tableRow: isDarkMode 
      ? "hover:bg-gradient-to-r hover:from-gray-700 hover:to-gray-600" 
      : "hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50",
    dialog: isDarkMode ? "bg-gradient-to-br from-gray-800 to-gray-700" : "bg-gradient-to-br from-white to-gray-50",
    input: isDarkMode 
      ? "bg-gray-700 border-gray-600 text-white focus:border-indigo-400" 
      : "border-gray-200 focus:border-indigo-500"
  };

  // Card View Component
  const CardView = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filteredSupplies.map((supply: Supply) => (
        <Card key={supply.id} className={`group hover:shadow-2xl transition-all duration-300 border-0 ${themeClasses.card} rounded-2xl overflow-hidden transform hover:-translate-y-1`}>
          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-4 min-w-0 flex-1">
                <TextureSwatch
                  texture={supply.texture}
                  hexColor={supply.hexColor}
                  name={supply.name}
                  size="lg"
                  isDarkMode={isDarkMode}
                />
                <div className="min-w-0 flex-1">
                  <h3 className={`text-lg font-bold ${themeClasses.text} truncate mb-1`} title={supply.name}>
                    {supply.name}
                  </h3>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className={`text-xs ${isDarkMode ? 'bg-gradient-to-r from-blue-900 to-purple-900 border-blue-700 text-blue-300' : 'bg-gradient-to-r from-blue-100 to-purple-100 border-blue-200 text-blue-800'}`}>
                      {supply.pieceSize}
                    </Badge>
                    <span className={`text-xs ${themeClasses.textSecondary}`}>•</span>
                    <span className={`text-xs ${themeClasses.textSecondary} font-medium`}>
                      {supply.location?.name || "No location"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(supply)}
                  className={`h-8 w-8 p-0 border-0 ${isDarkMode ? 'bg-gradient-to-r from-blue-800 to-indigo-800 hover:from-blue-700 hover:to-indigo-700 text-blue-300' : 'bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 text-blue-700'} rounded-xl`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setViewSupply(supply);
                    setDialogMode('view');
                    try {
                      const res = await fetch(`/api/supplies/${supply.id}/location-metrics`, { credentials: 'include' });
                      const data = await res.json();
                      setLocationMetrics(data || []);
                      setShowEditDialog(true);
                    } catch {
                      setLocationMetrics([]);
                      setShowEditDialog(true);
                    }
                  }}
                  className={`h-8 w-8 p-0 border-0 ${isDarkMode ? 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-slate-200' : 'bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700'} rounded-xl`}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSupplyToDelete(supply)}
                  className={`h-8 w-8 p-0 border-0 ${isDarkMode ? 'bg-gradient-to-r from-red-800 to-pink-800 hover:from-red-700 hover:to-pink-700 text-red-300' : 'bg-gradient-to-r from-red-100 to-pink-100 hover:from-red-200 hover:to-pink-200 text-red-700'} rounded-xl`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${themeClasses.textSecondary} font-medium`}>Part Number:</span>
                  <Badge className="">
                    {supply.partNumber || "—"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${themeClasses.textSecondary} font-medium`}>Retail Price:</span>
                  <Badge className="">
                    {formatPrice(supply.retailPrice)}
                  </Badge>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${themeClasses.textSecondary} font-medium`}>Catalog:</span>
                  <Badge className="">
                    {supply.availableInCatalog ? "Yes" : "No"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${themeClasses.textSecondary} font-medium`}>Available:</span>
                  <Badge className="">
                    {typeof supply.totalAvailable === 'number' ? supply.totalAvailable : Math.max(0, (supply.totalOnHand || 0) - (supply.totalAllocated || 0))}
                  </Badge>
                </div>
              </div>
            </div>
            
            {supply.defaultVendor && (
              <div className={`pt-4 border-t ${themeClasses.border}`}>
                <div className={`${isDarkMode ? 'bg-gradient-to-r from-indigo-900 to-purple-900' : 'bg-gradient-to-r from-indigo-50 to-purple-50'} rounded-xl p-3`}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className={`${themeClasses.textSecondary} font-medium`}>Vendor:</span>
                    <span className={`font-bold ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'} truncate ml-2`} title={supply.defaultVendor}>
                      {supply.defaultVendor}
                    </span>
                  </div>
                  {supply.defaultVendorPrice && (
                    <div className="flex justify-between items-center text-sm">
                      <span className={`${themeClasses.textSecondary} font-medium`}>Price:</span>
                      <span className={`font-bold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>{formatPrice(supply.defaultVendorPrice)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Table View Component
  const TableView = () => (
    <div className={`${themeClasses.table} rounded-2xl border-0 shadow-xl overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={`${themeClasses.header} text-white`}>
            <tr>              
              <th className="px-6 py-4 text-center">
                No
              </th>
              <th className="px-6 py-4 text-left text-sm font-bold uppercase tracking-wider">
                Material
              </th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                On Hand
              </th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                Allocated
              </th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                In Catalog
              </th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                Available
              </th>
              <th className="px-6 py-4 text-center text-sm font-bold uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={`divide-y ${themeClasses.border}`}>
            {filteredSupplies.map((supply: Supply, index: number) => (
              <tr key={supply.id} className={`${themeClasses.tableRow} transition-all duration-200 ${index % 2 === 0 ? (isDarkMode ? 'bg-gray-800' : 'bg-white') : (isDarkMode ? 'bg-gray-750' : 'bg-gray-50')}`}>
                <td style={{'textAlign':'center'}}>{index+1} </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-4">
                    <TextureSwatch
                      texture={supply.texture}
                      hexColor={supply.hexColor}
                      name={supply.name}
                      size="sm"
                      isDarkMode={isDarkMode}
                    />
                    <div className="min-w-0">
                      <div className={`text-sm font-bold ${themeClasses.text} truncate max-w-xs`} title={supply.name}>
                        {supply.name}
                      </div>
                      <Badge variant="outline" className={`text-xs mt-1 ${isDarkMode ? 'bg-gradient-to-r from-blue-900 to-purple-900 border-blue-700 text-blue-300' : 'bg-gradient-to-r from-blue-100 to-purple-100 border-blue-200 text-blue-800'}`}>
                        {supply.pieceSize}
                      </Badge>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`text-sm font-medium ${themeClasses.text}`}>
                    {typeof supply.totalOnHand === 'number' ? supply.totalOnHand : (supply.totalOnHand ?? 0)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`text-sm font-medium ${themeClasses.text}`}>
                    {typeof supply.totalAllocated === 'number' ? supply.totalAllocated : (supply.totalAllocated ?? 0)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`text-sm font-medium ${themeClasses.text}`}>
                    {supply.availableInCatalog ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`text-sm font-medium ${themeClasses.text}`}>
                    {Math.max(0, (supply.totalOnHand || 0) - (supply.totalAllocated || 0))}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(supply)}
                      className={`h-8 w-8 p-0 border-0 ${isDarkMode ? 'bg-gradient-to-r from-blue-800 to-indigo-800 hover:from-blue-700 hover:to-indigo-700 text-blue-300' : 'bg-gradient-to-r from-blue-100 to-indigo-100 hover:from-blue-200 hover:to-indigo-200 text-blue-700'} rounded-xl`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setViewSupply(supply);
                        setDialogMode('view');
                        try {
                          const res = await fetch(`/api/supplies/${supply.id}/location-metrics`, { credentials: 'include' });
                          const data = await res.json();
                          setLocationMetrics(data || []);
                          setShowEditDialog(true);
                        } catch {
                          setLocationMetrics([]);
                          setShowEditDialog(true);
                        }
                      }}
                      className={`h-8 w-8 p-0 border-0 ${isDarkMode ? 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-slate-200' : 'bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700'} rounded-xl`}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSupplyToDelete(supply)}
                      className={`h-8 w-8 p-0 border-0 ${isDarkMode ? 'bg-gradient-to-r from-red-800 to-pink-800 hover:from-red-700 hover:to-pink-700 text-red-300' : 'bg-gradient-to-r from-red-100 to-pink-100 hover:from-red-200 hover:to-pink-200 text-red-700'} rounded-xl`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Layout currentTime={currentTime}>
      <div className={`flex h-screen ${themeClasses.background}`}>
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className={`${themeClasses.header} ${isDarkMode ? 'border-gray-600' : 'border-indigo-200'} px-8 py-8 text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <nav className={`${isDarkMode ? 'text-gray-400' : 'text-indigo-200'} mb-3 text-sm font-medium`}>
                  <span>Home / Inventory / Supplies</span>
                </nav>
                <div className="flex items-center space-x-3">
                  <Sparkles className="w-8 h-8 text-yellow-300" />
                  <h1 className="text-4xl font-black">Supplies Management</h1>
                </div>
                <p className={`${isDarkMode ? 'text-gray-300' : 'text-indigo-100'} mt-2 text-lg font-medium`}>Manage your material inventory with style</p>
              </div>
              <div className="flex items-center space-x-4">
                

                <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200">
                      <Plus className="w-5 h-5 mr-2" />
                      Add Supply
                    </Button>
                  </DialogTrigger>
                  <DialogContent className={`max-w-6xl max-h-[90vh] overflow-y-auto ${themeClasses.dialog} border-0 rounded-2xl shadow-2xl`}>
                    <DialogHeader>
                      <DialogTitle className={`text-2xl font-bold ${isDarkMode ? 'bg-gradient-to-r from-indigo-400 to-purple-400' : 'bg-gradient-to-r from-indigo-600 to-purple-600'} bg-clip-text text-transparent`}>
                        ✨ Add New Supply
                      </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-8">
                      {/* Main Section */}
                      <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <h3 className={`text-lg font-bold mb-4 ${themeClasses.text}`}>Main Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Material Name</Label>
                        <Input
                          id="name"
                          value={supplyForm.name}
                          onChange={(e) => setSupplyForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter material name"
                          className={`mt-2 border-2 ${themeClasses.input} rounded-xl`}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="pieceSize" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Piece Size</Label>
                          <Select value={supplyForm.pieceSize} onValueChange={(value) => setSupplyForm(prev => ({ ...prev, pieceSize: value }))}>
                            <SelectTrigger className={`mt-2 border-2 ${themeClasses.input} rounded-xl`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                              <SelectItem value="sheet">Sheet</SelectItem>
                              <SelectItem value="piece">Piece</SelectItem>
                              <SelectItem value="pair">Pair</SelectItem>
                              <SelectItem value="roll">Roll</SelectItem>
                              <SelectItem value="box">Box</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                        <div className="grid grid-cols-2 gap-4 mt-4">
                        <div>
                            <Label htmlFor="partNumber" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Part Number</Label>
                          <Input
                              id="partNumber"
                              value={supplyForm.partNumber}
                              onChange={(e) => setSupplyForm(prev => ({ ...prev, partNumber: e.target.value }))}
                              placeholder="Enter part number (optional)"
                            className={`mt-2 border-2 ${themeClasses.input} rounded-xl`}
                          />
                        </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="availableInCatalog"
                              checked={supplyForm.availableInCatalog}
                              onCheckedChange={(checked) => setSupplyForm(prev => ({ ...prev, availableInCatalog: checked as boolean }))}
                              className="mt-2"
                            />
                            <Label htmlFor="availableInCatalog" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Available in Catalog</Label>
                        </div>
                      </div>
                      
                        <div className="mt-4">
                          {/* Description removed per requirement */}
                      </div>
                      
                        <div className="mt-4">
                        <Label className={`text-sm font-bold ${themeClasses.textSecondary}`}>Texture Image</Label>
                        <div className="flex items-center space-x-3 mt-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, false)}
                            className={`border-2 ${themeClasses.input} rounded-xl`}
                          />
                          {supplyForm.texture && (
                            <Button variant="outline" size="sm" onClick={() => clearTexture(false)} className="rounded-xl">
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {supplyForm.texture && (
                          <div className="mt-4 flex justify-center">
                            <TextureSwatch
                              texture={supplyForm.texture}
                              hexColor={supplyForm.hexColor}
                              name={supplyForm.name}
                              size="lg"
                              isDarkMode={isDarkMode}
                            />
                          </div>
                        )}
                        </div>
                      </div>
                      
                      {/* Vendors Section */}
                      <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-lg font-bold ${themeClasses.text}`}>Vendors</h3>
                          <Button 
                            onClick={() => addVendor(false)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Vendor
                          </Button>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                <th className="p-3 text-left font-bold">Preferred</th>
                                <th className="p-3 text-left font-bold">Vendor Name</th>
                                <th className="p-3 text-left font-bold">Part #</th>
                                <th className="p-3 text-left font-bold">Price ($)</th>
                                <th className="p-3 text-left font-bold">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {supplyForm.vendors.map((vendor, index) => (
                                <tr key={vendor.id} className={`border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                                  <td className="p-3">
                                    <input
                                      type="radio"
                                      name="preferredVendor"
                                      checked={vendor.isPreferred}
                                      onChange={() => {
                                        // Uncheck all others and check this one
                                        setSupplyForm(prev => ({
                                          ...prev,
                                          vendors: prev.vendors.map(v => ({
                                            ...v,
                                            isPreferred: v.id === vendor.id
                                          }))
                                        }));
                                      }}
                                      className="w-4 h-4"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <Select 
                                      value={vendor.vendorId?.toString() || "retail"} 
                                      onValueChange={(value) => updateVendor(vendor.id, 'vendorId', value === 'retail' ? undefined : parseInt(value), false)}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select vendor" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="retail">Retail ($0.00)</SelectItem>
                                        {vendors.map((v: Vendor) => (
                                          <SelectItem key={v.id} value={v.id.toString()}>
                                            {v.name && v.company ? `${v.name} — ${v.company}` : (v.name || v.company)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      value={vendor.vendorPartNumber}
                                      onChange={(e) => updateVendor(vendor.id, 'vendorPartNumber', e.target.value, false)}
                                      placeholder="Part number"
                                      className="w-full"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={(vendor.price / 100).toFixed(2)}
                                      onChange={(e) => updateVendor(vendor.id, 'price', Math.round(parseFloat(e.target.value || '0') * 100), false)}
                                      placeholder="0.00"
                                      className="w-full"
                                    />
                                  </td>
                                  <td className="p-3">
                                    {index > 0 && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeVendor(vendor.id, false)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Locations Section */}
                      <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-lg font-bold ${themeClasses.text}`}>Locations</h3>
                          <Button 
                            onClick={() => addLocation(false)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Location
                          </Button>
                        </div>
                        
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                <th className="p-3 text-left font-bold">Location Name</th>
                                <th className="p-3 text-left font-bold">On Hand</th>
                                <th className="p-3 text-left font-bold">Minimum Qty</th>
                                <th className="p-3 text-left font-bold">Order in Groups</th>
                                <th className="p-3 text-left font-bold">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {supplyForm.locations.map((location, index) => (
                                <tr key={location.id} className={`border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                                  <td className="p-3">
                                    <Select 
                                      value={location.locationId?.toString() || ""} 
                                      onValueChange={(value) => updateLocation(location.id, 'locationId', value ? parseInt(value) : undefined, false)}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select location" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {locations.map((loc: Location) => (
                                          <SelectItem key={loc.id} value={loc.id.toString()}>
                                            {loc.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={location.onHandQuantity}
                                      onChange={(e) => updateLocation(location.id, 'onHandQuantity', parseInt(e.target.value) || 0, false)}
                                      placeholder="0"
                                      className="w-full"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={location.minimumQuantity}
                                      onChange={(e) => updateLocation(location.id, 'minimumQuantity', parseInt(e.target.value) || 0, false)}
                                      placeholder="0"
                                      className="w-full"
                                    />
                                  </td>
                                  <td className="p-3">
                                    <Input
                                      type="number"
                                      min="1"
                                      value={location.orderGroupSize}
                                      onChange={(e) => updateLocation(location.id, 'orderGroupSize', parseInt(e.target.value) || 1, false)}
                                      placeholder="1"
                                      className="w-full"
                                    />
                                  </td>
                                  
                                  <td className="p-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => removeLocation(location.id, false)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-between items-center pt-6 border-t">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowAddDialog(false)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete This Item
                        </Button>
                        
                        <div className="flex space-x-3">
                          <Button 
                            variant="outline" 
                            onClick={() => setShowAddDialog(false)}
                            className="rounded-xl"
                          >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleAddSupply} 
                          disabled={createSupplyMutation.isPending}
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl"
                        >
                            {createSupplyMutation.isPending ? "Creating..." : "Save and Edit Next"}
                          </Button>
                          <Button 
                            onClick={handleAddSupply} 
                            disabled={createSupplyMutation.isPending}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl"
                          >
                            {createSupplyMutation.isPending ? "Creating..." : "Save"}
                        </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200">
                      <Plus className="w-5 h-5 mr-2" />
                      Add Location
                    </Button>
                  </DialogTrigger>
                  <DialogContent className={`max-w-md ${themeClasses.dialog} border-0 rounded-2xl shadow-2xl`}>
                    <DialogHeader>
                      <DialogTitle className={`text-2xl font-bold ${isDarkMode ? 'bg-gradient-to-r from-amber-400 to-orange-400' : 'bg-gradient-to-r from-amber-600 to-orange-600'} bg-clip-text text-transparent`}>
                        📍 Add New Location
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6">
                      <div>
                        <Label htmlFor="locationName" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Location Name</Label>
                        <Input
                          id="locationName"
                          value={newLocationName}
                          onChange={(e) => setNewLocationName(e.target.value)}
                          placeholder="Enter location name"
                          className={`mt-2 border-2 ${themeClasses.input} rounded-xl`}
                        />
                      </div>
                      <div className="flex justify-end space-x-3">
                        <Button variant="outline" onClick={() => setShowLocationDialog(false)} className="rounded-xl">
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleCreateLocation} 
                          disabled={createLocationMutation.isPending}
                          className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold rounded-xl"
                        >
                          {createLocationMutation.isPending ? "Creating..." : "✨ Create Location"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Search and Controls */}
          <div className={`${themeClasses.searchBar} backdrop-blur-sm border-b ${themeClasses.border} px-8 py-6`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6 flex-1">
                <div className="relative max-w-lg flex-1">
                  <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-400' : 'text-gray-400'} w-5 h-5`} />
                  <Input
                    placeholder="Search supplies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-12 py-3 border-2 ${themeClasses.input} rounded-xl shadow-sm text-lg`}
                  />
                </div>
                <div className={`flex items-center space-x-2 text-sm font-medium ${themeClasses.textSecondary} ${isDarkMode ? 'bg-gradient-to-r from-gray-700 to-gray-600' : 'bg-gradient-to-r from-gray-100 to-gray-200'} px-4 py-2 rounded-xl`}>
                  <Palette className="w-4 h-4" />
                  <span>{filteredSupplies.length} of {supplies.length} supplies</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {/* Filters: Category and Location */}
                <div className="flex items-center space-x-2">
                  <Label className={`${themeClasses.textSecondary} text-sm`}>Category</Label>
                  <Select value={categoryFilter === 'all' ? 'all' : String(categoryFilter)} onValueChange={(v) => setCategoryFilter(v === 'all' ? 'all' : parseInt(v))}>
                    <SelectTrigger className={`w-44 ${themeClasses.input} rounded-xl`}>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {(categories as LocationCategory[]).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Label className={`${themeClasses.textSecondary} text-sm`}>Location</Label>
                  <Select value={locationFilter === 'all' ? 'all' : String(locationFilter)} onValueChange={(v) => setLocationFilter(v === 'all' ? 'all' : parseInt(v))}>
                    <SelectTrigger className={`w-44 ${themeClasses.input} rounded-xl`}>
                      <SelectValue placeholder="All locations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {(locations as Location[]).map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className={`flex ${isDarkMode ? 'bg-gradient-to-r from-gray-700 to-gray-600' : 'bg-gradient-to-r from-gray-100 to-gray-200'} rounded-xl p-1`}>
                  <Button
                    variant={viewMode === "card" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("card")}
                    className={`${viewMode === "card" ? `${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'} font-bold` : `${themeClasses.textSecondary}`} rounded-xl`}
                  >
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Cards
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className={`${viewMode === "table" ? `${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg ${isDarkMode ? 'text-indigo-400' : 'text-indigo-700'} font-bold` : `${themeClasses.textSecondary}`} rounded-xl`}
                  >
                    <TableIcon className="w-4 h-4 mr-2" />
                    Table
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-8">
            {suppliesLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className={`w-16 h-16 ${isDarkMode ? 'bg-gradient-to-r from-indigo-400 to-purple-500' : 'bg-gradient-to-r from-indigo-500 to-purple-600'} rounded-full animate-pulse mx-auto mb-4`}></div>
                  <div className={`text-lg font-medium ${themeClasses.textSecondary}`}>Loading supplies...</div>
                </div>
              </div>
            ) : filteredSupplies.length === 0 ? (
              <div className="text-center py-20">
                <div className={`w-24 h-24 ${isDarkMode ? 'bg-gradient-to-r from-indigo-800 to-purple-800' : 'bg-gradient-to-r from-indigo-100 to-purple-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
                  <Package className={`w-12 h-12 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                </div>
                <h3 className={`text-2xl font-bold ${themeClasses.text} mb-3`}>
                  {searchTerm ? "🔍 No supplies found" : "🎨 No supplies yet"}
                </h3>
                <p className={`${themeClasses.textSecondary} mb-6 text-lg`}>
                  {searchTerm 
                    ? `No supplies match "${searchTerm}". Try adjusting your search.`
                    : "Get started by adding your first supply to the inventory."
                  }
                </p>
                {!searchTerm && (
                  <Button 
                    onClick={() => setShowAddDialog(true)} 
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold px-8 py-4 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    ✨ Add Your First Supply
                  </Button>
                )}
              </div>
            ) : (
              <>
                {viewMode === "card" ? <CardView /> : <TableView />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit/View Supply Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className={`max-w-6xl max-h-[90vh] overflow-y-auto ${themeClasses.dialog} border-0 rounded-2xl shadow-2xl`}>
          <DialogHeader>
            <DialogTitle className={`text-2xl font-bold ${isDarkMode ? 'bg-gradient-to-r from-indigo-400 to-purple-400' : 'bg-gradient-to-r from-indigo-600 to-purple-600'} bg-clip-text text-transparent`}>
              {dialogMode === 'view' ? '👁️ View Supply' : '✏️ Edit Supply'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-8">
            {dialogMode === 'edit' && (
            <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className={`text-lg font-bold mb-4 ${themeClasses.text}`}>Main Information</h3>
              <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="editName" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Material Name</Label>
              <Input
                id="editName"
                value={editSupplyForm.name}
                onChange={(e) => setEditSupplyForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter material name"
                className={`mt-2 border-2 ${themeClasses.input} rounded-xl`}
              />
            </div>
            
              <div>
                <Label htmlFor="editHexColor" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Color</Label>
                <Input
                  id="editHexColor"
                  type="color"
                  value={editSupplyForm.hexColor}
                  onChange={(e) => setEditSupplyForm(prev => ({ ...prev, hexColor: e.target.value }))}
                  className={`mt-2 h-12 border-2 ${themeClasses.input} rounded-xl`}
                />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Label htmlFor="editPieceSize" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Piece Size</Label>
                <Select value={editSupplyForm.pieceSize} onValueChange={(value) => setEditSupplyForm(prev => ({ ...prev, pieceSize: value }))}>
                  <SelectTrigger className={`mt-2 border-2 ${themeClasses.input} rounded-xl`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="sheet">Sheet</SelectItem>
                    <SelectItem value="piece">Piece</SelectItem>
                    <SelectItem value="pair">Pair</SelectItem>
                    <SelectItem value="roll">Roll</SelectItem>
                    <SelectItem value="box">Box</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            
              <div>
                  <Label htmlFor="editRetailPrice" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Retail Price (cents)</Label>
                <Input
                    id="editRetailPrice"
                  type="number"
                  min="0"
                    value={editSupplyForm.retailPrice}
                    onChange={(e) => setEditSupplyForm(prev => ({ ...prev, retailPrice: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                  className={`mt-2 border-2 ${themeClasses.input} rounded-xl`}
                />
              </div>
            </div>
            
              <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
                  <Label htmlFor="editPartNumber" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Part Number</Label>
              <Input
                    id="editPartNumber"
                    value={editSupplyForm.partNumber}
                    onChange={(e) => setEditSupplyForm(prev => ({ ...prev, partNumber: e.target.value }))}
                    placeholder="Enter part number (optional)"
                className={`mt-2 border-2 ${themeClasses.input} rounded-xl`}
              />
            </div>
            
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="editAvailableInCatalog"
                    checked={editSupplyForm.availableInCatalog}
                    onCheckedChange={(checked) => setEditSupplyForm(prev => ({ ...prev, availableInCatalog: checked as boolean }))}
                    className="mt-2"
                  />
                  <Label htmlFor="editAvailableInCatalog" className={`text-sm font-bold ${themeClasses.textSecondary}`}>Available in Catalog</Label>
                </div>
              </div>
              
              <div className="mt-4">
               <Label className={`text-sm font-bold ${themeClasses.textSecondary}`}>Texture Image</Label>
               <div className="flex items-center space-x-3 mt-2">
                 <Input
                   type="file"
                   accept="image/*"
                   onChange={(e) => handleFileUpload(e, true)}
                   className={`border-2 ${themeClasses.input} rounded-xl`}
                 />
                 {editSupplyForm.texture && (
                   <Button variant="outline" size="sm" onClick={() => clearTexture(true)} className="rounded-xl">
                     <X className="w-4 h-4" />
                   </Button>
                 )}
               </div>
               {editSupplyForm.texture && (
                 <div className="mt-4 flex justify-center">
                   <TextureSwatch
                     texture={editSupplyForm.texture}
                     hexColor={editSupplyForm.hexColor}
                     name={editSupplyForm.name}
                     size="lg"
                     isDarkMode={isDarkMode}
                   />
                 </div>
               )}
               </div>
             </div>
            )}

            {dialogMode === 'edit' && (
            <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${themeClasses.text}`}>Vendors</h3>
                <Button 
                  onClick={() => addVendor(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Vendor
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <th className="p-3 text-left font-bold">Preferred</th>
                      <th className="p-3 text-left font-bold">Vendor Name</th>
                      <th className="p-3 text-left font-bold">Part #</th>
                      <th className="p-3 text-left font-bold">Price ($)</th>
                      <th className="p-3 text-left font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editSupplyForm.vendors.map((vendor, index) => (
                      <tr key={vendor.id} className={`border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                        <td className="p-3">
                          <input
                            type="radio"
                            name="preferredVendorEdit"
                            checked={vendor.isPreferred}
                            onChange={() => {
                              // Uncheck all others and check this one
                              setEditSupplyForm(prev => ({
                                ...prev,
                                vendors: prev.vendors.map(v => ({
                                  ...v,
                                  isPreferred: v.id === vendor.id
                                }))
                              }));
                            }}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="p-3">
                          <Select 
                            value={vendor.vendorId?.toString() || "retail"} 
                            onValueChange={(value) => updateVendor(vendor.id, 'vendorId', value === 'retail' ? undefined : parseInt(value), true)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="retail">Retail ($0.00)</SelectItem>
                              {vendors.map((v: Vendor) => (
                                <SelectItem key={v.id} value={v.id.toString()}>
                                  {v.name && v.company ? `${v.name} — ${v.company}` : (v.name || v.company)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            value={vendor.vendorPartNumber}
                            onChange={(e) => updateVendor(vendor.id, 'vendorPartNumber', e.target.value, true)}
                            placeholder="Part number"
                            className="w-full"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={(vendor.price / 100).toFixed(2)}
                            onChange={(e) => updateVendor(vendor.id, 'price', Math.round(parseFloat(e.target.value || '0') * 100), true)}
                            placeholder="0.00"
                            className="w-full"
                          />
                        </td>
                        <td className="p-3">
                          {index > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => removeVendor(vendor.id, true)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Location Information (View-only analytics) */}
            {dialogMode === 'view' && viewSupply && (
              <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <h3 className={`text-lg font-bold mb-4 ${themeClasses.text}`}>Location Information</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                        <th className="p-3 text-left font-bold">Location</th>
                        <th className="p-3 text-right font-bold">On Hand</th>
                        <th className="p-3 text-right font-bold">Allocated</th>
                        <th className="p-3 text-right font-bold">Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locationMetrics.map((row) => (
                        <tr key={row.locationId} className={`border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                          <td className="p-3">{row.locationName || row.locationId}</td>
                          <td className="p-3 text-right">{row.onHandQuantity}</td>
                          <td className="p-3 text-right">{row.allocatedQuantity}</td>
                          <td className="p-3 text-right">{Math.max(0, (row.onHandQuantity || 0) - (row.allocatedQuantity || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                    {(() => {
                      const totalOnHand = locationMetrics.reduce((sum, r) => sum + (r.onHandQuantity || 0), 0);
                      const totalAllocated = locationMetrics.reduce((sum, r) => sum + (r.allocatedQuantity || 0), 0);
                      const totalAvailable = Math.max(0, totalOnHand - totalAllocated);
                      return (
                        <tfoot>
                          <tr className={`${isDarkMode ? 'bg-gray-900 text-gray-100' : 'bg-indigo-50 text-indigo-900'} font-bold border-t-2 ${isDarkMode ? 'border-gray-500' : 'border-indigo-300'}`}>
                            <td className="p-3">Sum (Total)</td>
                            <td className="p-3 text-right">{totalOnHand}</td>
                            <td className="p-3 text-right">{totalAllocated}</td>
                            <td className="p-3 text-right">{totalAvailable}</td>
                          </tr>
                        </tfoot>
                      );
                    })()}
                  </table>
                </div>
              </div>
            )}

            {dialogMode === 'edit' && (
            <div className={`p-6 rounded-xl ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-bold ${themeClasses.text}`}>Locations</h3>
                <Button 
                  onClick={() => addLocation(true)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Location
                </Button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <th className="p-3 text-left font-bold">Location Name</th>
                      <th className="p-3 text-left font-bold">On Hand</th>
                      <th className="p-3 text-left font-bold">Minimum Qty</th>
                      <th className="p-3 text-left font-bold">Order in Groups</th>
                      <th className="p-3 text-left font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editSupplyForm.locations.map((location, index) => (
                      <tr key={location.id} className={`border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                        <td className="p-3">
                          <Select 
                            value={location.locationId?.toString() || ""} 
                            onValueChange={(value) => updateLocation(location.id, 'locationId', value ? parseInt(value) : undefined, true)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((loc: Location) => (
                                <SelectItem key={loc.id} value={loc.id.toString()}>
                                  {loc.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            value={location.onHandQuantity}
                            onChange={(e) => updateLocation(location.id, 'onHandQuantity', parseInt(e.target.value) || 0, true)}
                            placeholder="0"
                            className="w-full"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="0"
                            value={location.minimumQuantity}
                            onChange={(e) => updateLocation(location.id, 'minimumQuantity', parseInt(e.target.value) || 0, true)}
                            placeholder="0"
                            className="w-full"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            min="1"
                            value={location.orderGroupSize}
                            onChange={(e) => updateLocation(location.id, 'orderGroupSize', parseInt(e.target.value) || 1, true)}
                            placeholder="1"
                            className="w-full"
                          />
                        </td>
                        
                        <td className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeLocation(location.id, true)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {dialogMode === 'edit' && (
            <div className="flex justify-between items-center pt-6 border-t">
              <Button 
                variant="outline" 
                onClick={() => setSupplyToDelete(editingSupply)}
                className="text-red-600 hover:text-red-700"
              >
                Delete This Item
              </Button>
              
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowEditDialog(false)}
                  className="rounded-xl"
                >
                Cancel
              </Button>
              <Button 
                onClick={handleEditSupply} 
                disabled={updateSupplyMutation.isPending}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl"
              >
                  {updateSupplyMutation.isPending ? "Updating..." : "Save and Edit Next"}
                </Button>
                <Button 
                  onClick={handleEditSupply} 
                  disabled={updateSupplyMutation.isPending}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl"
                >
                  {updateSupplyMutation.isPending ? "Updating..." : "Save"}
              </Button>
              </div>
            </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!supplyToDelete} onOpenChange={() => setSupplyToDelete(null)}>
        <AlertDialogContent className={`${isDarkMode ? 'bg-gradient-to-br from-gray-800 to-red-900' : 'bg-gradient-to-br from-white to-red-50'} border-0 rounded-2xl shadow-2xl`}>
          <AlertDialogHeader>
            <AlertDialogTitle className={`text-2xl font-bold ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>
              🗑️ Delete Supply
            </AlertDialogTitle>
            <AlertDialogDescription className={`${isDarkMode ? 'text-gray-300' : 'text-gray-700'} text-lg`}>
              Are you sure you want to delete <span className={`font-bold ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>"{supplyToDelete?.name}"</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSupplyToDelete(null)} className="rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSupply}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold rounded-xl"
            >
              🗑️ Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}