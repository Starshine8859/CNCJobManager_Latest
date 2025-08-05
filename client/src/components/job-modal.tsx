import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { createJobSchema, type CreateJob, type ColorWithGroup } from "@shared/schema";

interface JobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function JobModal({ open, onOpenChange }: JobModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CreateJob>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      customerName: "",
      jobName: "",
      materials: [{ colorId: 0, totalSheets: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "materials",
  });

  // Fetch colors for the dropdown
  const { data: colors = [] } = useQuery<ColorWithGroup[]>({
    queryKey: ['/api/colors'],
  });

  const createJobMutation = useMutation({
    mutationFn: (data: CreateJob) => apiRequest('POST', '/api/jobs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      onOpenChange(false);
      form.reset();
      toast({
        title: "Success",
        description: "Job created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create job",
        variant: "destructive",
      });
    },
  });

  // Listen for the custom event from layout
  useEffect(() => {
    const handleOpenJobModal = () => {
      onOpenChange(true);
    };

    window.addEventListener('openJobModal', handleOpenJobModal);
    return () => window.removeEventListener('openJobModal', handleOpenJobModal);
  }, [onOpenChange]);

  const onSubmit = (data: CreateJob) => {
    // Filter out invalid materials (colorId = 0)
    const validMaterials = data.materials.filter(m => m.colorId > 0);
    
    if (validMaterials.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one material color",
        variant: "destructive",
      });
      return;
    }

    createJobMutation.mutate({
      ...data,
      materials: validMaterials,
    });
  };

  const addMaterial = () => {
    append({ colorId: 0, totalSheets: 1 });
  };

  const removeMaterial = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  // Group colors by group
  const groupedColors = colors.reduce((acc, color) => {
    const groupName = color.group?.name || "Ungrouped";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(color);
    return acc;
  }, {} as Record<string, ColorWithGroup[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Job Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter customer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jobName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter job name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Materials Section */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Materials Required</h4>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-end space-x-3 p-3 bg-gray-50 rounded-md">
                    <FormField
                      control={form.control}
                      name={`materials.${index}.colorId`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Material Color</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value))} 
                            value={field.value?.toString() || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select Color" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(groupedColors).map(([groupName, groupColors]) => (
                                <div key={groupName}>
                                  <div className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100">
                                    {groupName}
                                  </div>
                                  {groupColors.map((color) => (
                                    <SelectItem key={color.id} value={color.id.toString()}>
                                      <div className="flex items-center space-x-2">
                                        {/* Show texture image if available, otherwise fallback to color */}
                                        {color.texture ? (
                                          <img
                                            src={color.texture}
                                            alt={color.name}
                                            className="w-6 h-6 rounded border object-cover"
                                          />
                                        ) : (
                                          <div 
                                            className="w-6 h-6 rounded border"
                                            style={{ backgroundColor: color.hexColor }}
                                          />
                                        )}
                                        <span>{color.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </div>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`materials.${index}.totalSheets`}
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormLabel>Qty</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min="1" 
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMaterial(index)}
                      disabled={fields.length === 1}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addMaterial}
                  className="w-full border-2 border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Material
                </Button>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createJobMutation.isPending}
              >
                {createJobMutation.isPending ? "Creating..." : "Create Job"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
