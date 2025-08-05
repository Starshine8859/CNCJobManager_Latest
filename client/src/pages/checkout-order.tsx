import { useState } from "react";
import { ShoppingCart, ArrowLeft, ArrowRight, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Layout from "@/components/layout";

interface NeedToPurchaseItem {
  id: number;
  location: string;
  item: string;
  pieceSize: string;
  onHand: number;
  allocated: number;
  minimumQty: number;
  qtyToOrder: number;
}

const mockNeedToPurchase: NeedToPurchaseItem[] = [
  { id: 1, location: "1-Sheet Materials", item: "1/4\" River Rock", pieceSize: "1 Sheet", onHand: 3, allocated: 0, minimumQty: 10, qtyToOrder: 20 },
  { id: 2, location: "1-Sheet Materials", item: "5/8\" White Melamine", pieceSize: "1 Sheet", onHand: 0, allocated: 0, minimumQty: 10, qtyToOrder: 20 },
  { id: 3, location: "5-Drawer Glides", item: "10\" full extension drawer slide", pieceSize: "1 Pair", onHand: 1, allocated: 0, minimumQty: 5, qtyToOrder: 10 },
  { id: 4, location: "5-Drawer Glides", item: "12\" full extension drawer slide", pieceSize: "1 Pair", onHand: 7, allocated: 0, minimumQty: 20, qtyToOrder: 40 },
  { id: 5, location: "5-Drawer Glides", item: "14\" full extension drawer slide", pieceSize: "1 Pair", onHand: 0, allocated: 0, minimumQty: 10, qtyToOrder: 20 },
  { id: 6, location: "5-Drawer Glides", item: "16\" full extension drawer slide", pieceSize: "1 Pair", onHand: 5, allocated: 0, minimumQty: 20, qtyToOrder: 40 },
];

const locations = [
  "1-Sheet Materials",
  "2-Edgebandings", 
  "3-Hardwood Materials",
  "4-Drawer Box Materials",
  "5-Drawer Glides",
  "6-Hinges / Plates / Handles",
  "7-Accessories / Inserts",
  "8-Other Inventory",
  "Bay 1", "Bay 2", "Bay 3", "Bay 4", "Bay 5", "Bay 6", "Bay 7",
  "Rack 1", "Rack 2", "Rack 3", "Shipping Goods"
];

const items = [
  "1/4\" River Rock",
  "5/8\" White Melamine", 
  "10\" full extension drawer slide",
  "12\" full extension drawer slide",
  "14\" full extension drawer slide",
  "16\" full extension drawer slide"
];

export default function CheckoutOrder() {
  const [currentTime] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [itemInfo, setItemInfo] = useState("");
  const [moveToLocation, setMoveToLocation] = useState(false);
  const [moveToLocationText, setMoveToLocationText] = useState("");
  const [trackToOrder, setTrackToOrder] = useState(false);
  const [trackToOrderText, setTrackToOrderText] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  return (
    <Layout currentTime={currentTime}>
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Header */}
        <div className="mb-6">
          <nav className="text-sm text-gray-500 mb-2">
            <span>Home / Supplies</span>
          </nav>
          <div className="text-center mb-4">
            <div className="text-sm text-gray-600">
              <div>Order Minimum</div>
              <div className="text-xs">$200 per color/style</div>
              <div className="text-xs">Orders under $200: $100 fee</div>
              <div className="text-xs italic">Terms and conditions apply</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Check-In / Check-Out Form */}
          <Card>
            <CardHeader>
              <CardTitle>Check-In / Check-Out</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Location</label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger>
                        <SelectValue placeholder="-Select-" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location} value={location}>
                            {location}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Item</label>
                    <Select value={selectedItem} onValueChange={setSelectedItem}>
                      <SelectTrigger>
                        <SelectValue placeholder={selectedLocation ? "-Select-" : "-Select A Location First-"} />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Item Info</label>
                    <Input 
                      value={itemInfo} 
                      onChange={(e) => setItemInfo(e.target.value)}
                      placeholder="Item information will appear here"
                      readOnly
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      checked={moveToLocation} 
                      onCheckedChange={(checked) => setMoveToLocation(checked === true)}
                    />
                    <label className="text-sm">Move From/To Another Location</label>
                  </div>
                  {moveToLocation && (
                    <Input 
                      value={moveToLocationText}
                      onChange={(e) => setMoveToLocationText(e.target.value)}
                      placeholder="Enter location"
                    />
                  )}

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      checked={trackToOrder} 
                      onCheckedChange={(checked) => setTrackToOrder(checked === true)}
                    />
                    <label className="text-sm">Track To An Order</label>
                  </div>
                  {trackToOrder && (
                    <Input 
                      value={trackToOrderText}
                      onChange={(e) => setTrackToOrderText(e.target.value)}
                      placeholder="Enter order number"
                    />
                  )}

                  <div>
                    <label className="text-sm font-medium mb-2 block">Quantity</label>
                    <Input 
                      type="number"
                      value={quantity} 
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Enter quantity"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Note</label>
                    <Textarea 
                      value={note} 
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Enter any notes"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 mt-6">
                <Button variant="outline" className="flex items-center space-x-2">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Check In</span>
                </Button>
                <Button className="flex items-center space-x-2">
                  <ArrowRight className="h-4 w-4" />
                  <span>Check Out</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Need To Purchase Table */}
          <Card>
            <CardHeader>
              <CardTitle>Need To Purchase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">
                        <Checkbox />
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">LOCATION</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">ITEM</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">PIECE SIZE</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">ON HAND</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">ALLOCATED</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">MINIMUM QTY</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">QTY TO ORDER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockNeedToPurchase.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <Checkbox />
                        </td>
                        <td className="py-3 px-4">{item.location}</td>
                        <td className="py-3 px-4">{item.item}</td>
                        <td className="py-3 px-4 text-gray-600">{item.pieceSize}</td>
                        <td className="py-3 px-4">{item.onHand}</td>
                        <td className="py-3 px-4">{item.allocated}</td>
                        <td className="py-3 px-4">{item.minimumQty}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-2">
                            <Input 
                              type="number"
                              value={item.qtyToOrder}
                              className="w-20"
                            />
                            <Package className="h-4 w-4 text-gray-400" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
} 