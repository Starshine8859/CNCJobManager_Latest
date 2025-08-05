import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Edit, Trash2, Users, Palette, Upload, X, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import Layout from "@/components/layout";
import { insertUserSchema, insertColorSchema, insertColorGroupSchema } from "@shared/schema";
import type { User, ColorWithGroup, ColorGroup } from "@shared/schema";

export default function Admin() {
  const [currentTime] = useState(new Date());
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [showColorDialog, setShowColorDialog] = useState(false);
  const [showEditColorDialog, setShowEditColorDialog] = useState(false);
  const [editingColor, setEditingColor] = useState<ColorWithGroup | null>(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showDeleteColorDialog, setShowDeleteColorDialog] = useState(false);
  const [colorToDelete, setColorToDelete] = useState<ColorWithGroup | null>(null);
  const [uploadedTextureUrl, setUploadedTextureUrl] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Allow all authenticated users to access the admin page
  // Different features will be restricted based on role within the page

  // Forms
  const userForm = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", password: "", role: "operator" },
  });

  const colorForm = useForm({
    resolver: zodResolver(insertColorSchema),
    defaultValues: { name: "", hexColor: "#FFFFFF", groupId: undefined, texture: "" },
  });

  const editColorForm = useForm({
    resolver: zodResolver(insertColorSchema),
    defaultValues: { name: "", hexColor: "#FFFFFF", groupId: undefined, texture: "" },
  });

  const groupForm = useForm({
    resolver: zodResolver(insertColorGroupSchema),
    defaultValues: { name: "" },
  });

  // Queries
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: user?.role === 'admin',
  });

  const { data: colors = [] } = useQuery<ColorWithGroup[]>({
    queryKey: ['/api/colors'],
  });

  const { data: colorGroups = [] } = useQuery<ColorGroup[]>({
    queryKey: ['/api/color-groups'],
  });

  // File upload mutation
  const uploadTextureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('texture', file);
      
      const response = await fetch('/api/upload-texture', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setUploadedTextureUrl(data.fileUrl);
      // Set texture for the appropriate form based on which dialog is open
      if (showEditColorDialog) {
        editColorForm.setValue('texture', data.fileUrl);
      } else {
        colorForm.setValue('texture', data.fileUrl);
      }
      setIsUploading(false);
      toast({ title: "Success", description: "Texture uploaded successfully" });
    },
    onError: () => {
      setIsUploading(false);
      toast({ title: "Error", description: "Failed to upload texture", variant: "destructive" });
    },
  });

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      uploadTextureMutation.mutate(file);
    }
  };

  const handleEditFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      uploadTextureMutation.mutate(file);
    }
  };

  // Clear uploaded texture
  const clearTexture = () => {
    setUploadedTextureUrl("");
    colorForm.setValue('texture', "");
  };

  const clearEditTexture = () => {
    setUploadedTextureUrl("");
    editColorForm.setValue('texture', "");
  };

  // Handle opening edit dialog
  const handleEditColor = (color: ColorWithGroup) => {
    console.log('Opening edit dialog for color:', color);
    setEditingColor(color);
    editColorForm.reset({
      name: color.name,
      hexColor: color.hexColor,
      groupId: color.groupId || undefined as any,
      texture: color.texture || "",
    });
    setUploadedTextureUrl(color.texture || "");
    setShowEditColorDialog(true);
  };

  const handleDeleteColor = (color: ColorWithGroup) => {
    setColorToDelete(color);
    setShowDeleteColorDialog(true);
  };

  const confirmDeleteColor = () => {
    if (colorToDelete) {
      deleteColorMutation.mutate(colorToDelete.id);
      setShowDeleteColorDialog(false);
      setColorToDelete(null);
    }
  };

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowUserDialog(false);
      userForm.reset();
      toast({ title: "Success", description: "User created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({ title: "Success", description: "User deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createColorMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/colors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/colors'] });
      setShowColorDialog(false);
      colorForm.reset();
      setUploadedTextureUrl("");
      toast({ title: "Success", description: "Color created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteColorMutation = useMutation({
    mutationFn: (id: number) => {
      console.log('Attempting to delete color with ID:', id);
      return apiRequest('DELETE', `/api/colors/${id}`);
    },
    onSuccess: () => {
      console.log('Color deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['/api/colors'] });
      toast({ title: "Success", description: "Color deleted successfully" });
    },
    onError: (error: any) => {
      console.error('Delete color error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateColorMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PUT', `/api/colors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/colors'] });
      editColorForm.reset();
      setShowEditColorDialog(false);
      setEditingColor(null);
      setUploadedTextureUrl("");
      toast({ title: "Success", description: "Color updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update color", variant: "destructive" });
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/color-groups', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/color-groups'] });
      setShowGroupDialog(false);
      groupForm.reset();
      toast({ title: "Success", description: "Color group created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/color-groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/color-groups'] });
      queryClient.invalidateQueries({ queryKey: ['/api/colors'] });
      toast({ title: "Success", description: "Color group deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Layout currentTime={currentTime}>
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Administration</h2>
          <p className="text-gray-600 mt-1">Manage users, colors, and system settings</p>
        </div>

        <Tabs defaultValue="colors" className="space-y-6">
          <TabsList>
            <TabsTrigger value="colors">Colors & Materials</TabsTrigger>
            {user?.role === 'admin' && <TabsTrigger value="users">Users</TabsTrigger>}
          </TabsList>

          <TabsContent value="colors" className="space-y-6">
            {/* Color Groups */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Palette className="h-5 w-5" />
                    <span>Color Groups</span>
                  </CardTitle>
                  <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Group
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Color Group</DialogTitle>
                      </DialogHeader>
                      <Form {...groupForm}>
                        <form onSubmit={groupForm.handleSubmit((data) => createGroupMutation.mutate(data))} className="space-y-4">
                          <FormField
                            control={groupForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Group Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Wood Grains, Solid Colors" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setShowGroupDialog(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={createGroupMutation.isPending}>
                              Create Group
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {colorGroups.map((group) => (
                    <div key={group.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{group.name}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteGroupMutation.mutate(group.id)}
                          disabled={deleteGroupMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {colors.filter(c => c.groupId === group.id).length} colors
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Colors */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Colors</CardTitle>
                  <Dialog open={showColorDialog} onOpenChange={setShowColorDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Color
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create Color</DialogTitle>
                      </DialogHeader>
                      <Form {...colorForm}>
                        <form onSubmit={colorForm.handleSubmit((data) => createColorMutation.mutate(data))} className="space-y-4">
                          <FormField
                            control={colorForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Color Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Biscuit, Walnut, White Melamine" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          {/* Texture Upload Section */}
                          <FormField
                            control={colorForm.control}
                            name="texture"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Material Texture Image</FormLabel>
                                <FormControl>
                                  <div className="space-y-3">
                                    {/* Upload Area */}
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="texture-upload"
                                        disabled={isUploading}
                                      />
                                      <label htmlFor="texture-upload" className="cursor-pointer">
                                        <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                                        <p className="text-sm text-gray-600">
                                          {isUploading ? "Uploading..." : "Click to upload texture image"}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                          PNG, JPG up to 5MB
                                        </p>
                                      </label>
                                    </div>
                                    
                                    {/* Preview */}
                                    {(uploadedTextureUrl || field.value) && (
                                      <div className="relative">
                                        <img
                                          src={uploadedTextureUrl || field.value}
                                          alt="Texture preview"
                                          className="w-full h-32 object-cover rounded-lg border"
                                        />
                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="sm"
                                          onClick={clearTexture}
                                          className="absolute top-2 right-2"
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={colorForm.control}
                            name="hexColor"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fallback Color (if no image)</FormLabel>
                                <FormControl>
                                  <div className="flex space-x-2">
                                    <Input type="color" className="w-20" {...field} />
                                    <Input placeholder="#FFFFFF" {...field} />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={colorForm.control}
                            name="groupId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Color Group</FormLabel>
                                <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value ? String(field.value) : ""}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a group" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {colorGroups.map((group) => (
                                      <SelectItem key={group.id} value={group.id.toString()}>
                                        {group.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" onClick={() => setShowColorDialog(false)}>
                              Cancel
                            </Button>
                            <Button type="submit" disabled={createColorMutation.isPending}>
                              Create Color
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>

                  {/* Edit Color Dialog */}
                  <Dialog open={showEditColorDialog} onOpenChange={setShowEditColorDialog}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Edit Color: {editingColor?.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium">Color Name</label>
                          <input
                            type="text"
                            value={editColorForm.watch('name')}
                            onChange={(e) => editColorForm.setValue('name', e.target.value)}
                            placeholder="e.g., Biscuit, Walnut, White Melamine"
                            className="w-full p-2 border rounded mt-1"
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Fallback Color</label>
                          <div className="flex space-x-2 mt-1">
                            <input
                              type="color"
                              value={editColorForm.watch('hexColor')}
                              onChange={(e) => editColorForm.setValue('hexColor', e.target.value)}
                              className="w-20 h-10"
                            />
                            <input
                              type="text"
                              value={editColorForm.watch('hexColor')}
                              onChange={(e) => editColorForm.setValue('hexColor', e.target.value)}
                              placeholder="#FFFFFF"
                              className="flex-1 p-2 border rounded"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Color Group</label>
                          <select
                            value={editColorForm.watch('groupId') || ''}
                            onChange={(e) => editColorForm.setValue('groupId', e.target.value ? parseInt(e.target.value) : undefined as any)}
                            className="w-full p-2 border rounded mt-1"
                          >
                            <option value="">No Group</option>
                            {colorGroups.map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium">Texture Image</label>
                          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center mt-1">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleEditFileUpload}
                              className="hidden"
                              id="edit-texture-upload"
                              disabled={isUploading}
                            />
                            <label htmlFor="edit-texture-upload" className="cursor-pointer">
                              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                              <p className="text-sm text-gray-600">
                                {isUploading ? "Uploading..." : "Click to upload texture image"}
                              </p>
                            </label>
                          </div>
                          {editColorForm.watch('texture') && (
                            <div className="mt-2">
                              <img
                                src={editColorForm.watch('texture')}
                                alt="Texture preview"
                                className="w-full h-32 object-cover rounded border"
                              />
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setShowEditColorDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => {
                              const data = editColorForm.getValues();
                              console.log('Edit form submitted:', data);
                              if (editingColor) {
                                updateColorMutation.mutate({ id: editingColor.id, data });
                              }
                            }}
                            disabled={updateColorMutation.isPending}
                          >
                            Update Color
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {colors.map((color) => (
                    <div key={color.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {/* Show texture image if available, otherwise fallback to color */}
                          {color.texture ? (
                            <img
                              src={color.texture}
                              alt={color.name}
                              className="w-12 h-12 rounded border object-cover"
                            />
                          ) : (
                            <div 
                              className="w-12 h-12 rounded border"
                              style={{ backgroundColor: color.hexColor }}
                            />
                          )}
                          <div>
                            <h4 className="font-medium">{color.name}</h4>
                            {color.group && (
                              <p className="text-sm text-gray-500">{color.group.name}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditColor(color)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteColor(color)}
                            disabled={deleteColorMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {user?.role === 'admin' && (
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="h-5 w-5" />
                      <span>Users</span>
                    </CardTitle>
                    <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Add User
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create User</DialogTitle>
                        </DialogHeader>
                        <Form {...userForm}>
                          <form onSubmit={userForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
                            <FormField
                              control={userForm.control}
                              name="username"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Username</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Enter username" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={userForm.control}
                              name="password"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Password</FormLabel>
                                  <FormControl>
                                    <Input type="password" placeholder="Enter password" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={userForm.control}
                              name="role"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Role</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="operator">Operator</SelectItem>
                                      <SelectItem value="view_admin">View Admin</SelectItem>
                                      <SelectItem value="admin">Admin</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end space-x-2">
                              <Button type="button" variant="outline" onClick={() => setShowUserDialog(false)}>
                                Cancel
                              </Button>
                              <Button type="submit" disabled={createUserMutation.isPending}>
                                Create User
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h4 className="font-medium">{u.username}</h4>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                              {u.role.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              Created: {new Date(u.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {u.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteUserMutation.mutate(u.id)}
                            disabled={deleteUserMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}


        </Tabs>

        {/* Delete Color Confirmation Dialog */}
        <AlertDialog open={showDeleteColorDialog} onOpenChange={setShowDeleteColorDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span>Delete Color</span>
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the color "{colorToDelete?.name}"? 
                <br />
                <br />
                <strong>Warning:</strong> This action cannot be undone. If this color is being used in any jobs, the deletion will fail.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={confirmDeleteColor}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteColorMutation.isPending}
              >
                {deleteColorMutation.isPending ? "Deleting..." : "Delete Color"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
