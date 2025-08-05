import { useState } from "react";
import { MapPin, Plus, Search, Trash2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Layout from "@/components/layout";

interface SupplyLocation {
  id: number;
  name: string;
  items: number;
  active: boolean;
}

const mockLocations: SupplyLocation[] = [
  { id: 1, name: "1 - Sheet Materials", items: 163, active: true },
  { id: 2, name: "2 - Edgebandings", items: 10, active: true },
  { id: 3, name: "3 - Hardwood Materials", items: 2, active: true },
  { id: 4, name: "4 - Drawer Box Materials", items: 66, active: true },
  { id: 5, name: "5 - Drawer Glides", items: 46, active: true },
  { id: 6, name: "6 - Hinges / Plates / Handles", items: 7, active: true },
  { id: 7, name: "7 - Accessories / Inserts", items: 23, active: true },
  { id: 8, name: "8 - Other Inventory", items: 2, active: true },
  { id: 9, name: "Bay 1", items: 0, active: true },
  { id: 10, name: "Bay 2", items: 1, active: true },
  { id: 11, name: "Bay 3", items: 1, active: true },
  { id: 12, name: "Bay 4", items: 1, active: true },
  { id: 13, name: "Bay 5", items: 1, active: true },
  { id: 14, name: "Bay 6", items: 0, active: true },
  { id: 15, name: "Bay 7", items: 0, active: true },
  { id: 16, name: "Rack 1", items: 1, active: true },
  { id: 17, name: "Rack 2", items: 4, active: true },
  { id: 18, name: "Rack 3", items: 3, active: true },
  { id: 19, name: "Shipping Goods", items: 0, active: true },
];

export default function SupplyLocations() {
  const [currentTime] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState("25");
  const [locations, setLocations] = useState(mockLocations);

  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleActive = (id: number) => {
    setLocations(prev => 
      prev.map(location => 
        location.id === id 
          ? { ...location, active: !location.active }
          : location
      )
    );
  };

  const deleteLocation = (id: number) => {
    setLocations(prev => prev.filter(location => location.id !== id));
  };

  return (
    <Layout currentTime={currentTime}>
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">Supply Locations</h1>
            <Info className="h-5 w-5 text-gray-400" />
          </div>
          
          {/* Search Bar */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <Select value={rowsPerPage} onValueChange={setRowsPerPage}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Location Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Items</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Active</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocations.map((location) => (
                    <tr key={location.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{location.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-600">{location.items} {location.items === 1 ? 'item' : 'items'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Switch
                          checked={location.active}
                          onCheckedChange={() => toggleActive(location.id)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLocation(location.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="mt-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Rows per page:</span>
            <Select value={rowsPerPage} onValueChange={setRowsPerPage}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-gray-600">
            1-{filteredLocations.length} of {filteredLocations.length}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <span>POWERED BY</span>
            <div className="font-bold">ALLIMICRY</div>
          </div>
          <div>Copyright ©2023 Allimicry Inc. | v1.0.0 Production</div>
        </div>
      </div>
    </Layout>
  );
} 