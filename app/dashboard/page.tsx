"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import Image from "next/image"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in-progress",
  DONE = "done",
}

interface UserData {
  id: string
  email: string
  username?: string
  picture?: string
}

interface Label {
  id: string
  name: string
  color: string
}

interface Task {
  id: string
  title: string
  description: string
  status: "todo" | "in-progress" | "done"
  due_date: string
  created_at: string
  labels: Label[]
}

interface RawTask {
  id: string
  title: string
  description: string
  status: string
  due_date: string
  created_at: string
  labels: { labels: Label[] }[]
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<UserData | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)

  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [isCreateLabelOpen, setIsCreateLabelOpen] = useState(false)
  const [filter, setFilter] = useState("all")

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    status: "todo" as "todo" | "in-progress" | "done",
    due_date: "",
    selectedLabels: [] as string[],
  })

  const [labelForm, setLabelForm] = useState({
    name: "",
    color: "59 130 246",
  })

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data?.user) {
        router.push("/")
        return
      }
      setUser({
        id: data.user.id,
        email: data.user.email!,
        username: data.user.user_metadata?.name,
        picture: data.user.user_metadata?.picture,
      })
      setLoading(false)
    }
    fetchUser()
  }, [supabase, router])

  const fetchTasks = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("tasks")
      .select(`
        id,
        title,
        description,
        status,
        due_date,
        created_at,
        labels:task_labels(
          labels(
            id,
            name,
            color
          )
        )
      `)
      .eq("user_id", userId)

    if (!error && data) {
      const formatted: Task[] = (data as RawTask[]).map((task) => ({
        ...task,
        status: task.status as Task["status"],
        labels: task.labels.flatMap((l) => l.labels),
      }))
      setTasks(formatted)
      }
  }, [supabase])

  useEffect(() => {
    const fetchLabels = async () => {
      const { data, error } = await supabase.from("labels").select("*")
      if (!error && data) setLabels(data)
    }
    fetchLabels()
  }, [supabase])

  useEffect(() => {
    if (user) fetchTasks(user.id)
  }, [user, fetchTasks])

  const handleCreateTask = async () => {
    if (!user) return
    const { data: newTask, error } = await supabase
      .from("tasks")
      .insert([
        {
          title: taskForm.title,
          description: taskForm.description,
          status: taskForm.status,
          due_date: taskForm.due_date || new Date().toISOString().split("T")[0],
          user_id: user.id,
        },
      ])
      .select()
      .single()

    if (error || !newTask) return

    if (taskForm.selectedLabels.length > 0) {
      const taskLabels = taskForm.selectedLabels.map((labelId) => ({
        task_id: newTask.id,
        label_id: labelId,
      }))
      await supabase.from("task_labels").insert(taskLabels)
    }

    await fetchTasks(user.id)
    setIsCreateTaskOpen(false)
    setTaskForm({ title: "", description: "", status: "todo", due_date: "", selectedLabels: [] })
  }

  const handleUpdateTask = async (taskId: string, updates: Partial<Task>) => {
    if (!user) return
    const { error } = await supabase.from("tasks").update(updates).eq("id", taskId)
    if (error) {
      console.error("Error updating task:", error)
      return
    }
    await fetchTasks(user.id)
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return
    await supabase.from("tasks").delete().eq("id", taskId)
    fetchTasks(user.id)
  }

  const handleCreateLabel = async () => {
    const { data, error } = await supabase
      .from("labels")
      .insert([{ name: labelForm.name, color: labelForm.color }])
      .select()
      .single()

    if (!error && data) setLabels([...labels, data])
    setIsCreateLabelOpen(false)
    setLabelForm({ name: "", color: "59 130 246" })
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "done":
        return "bg-green-500/80 text-white border-green-600"
      case "in-progress":
        return "bg-blue-500/80 text-white border-blue-600"
      case "todo":
      default:
        return "bg-gray-500/70 text-white border-gray-600"
    }
  }
  
  const getStatusLabel = (status: Task["status"]) => {
    switch (status) {
      case "done":
        return "Done"
      case "in-progress":
        return "In Progress"
      case "todo":
      default:
        return "To Do"
    }
  }

  const toggleLabel = (labelId: string) => {
    setTaskForm((prev) => ({
      ...prev,
      selectedLabels: prev.selectedLabels.includes(labelId)
        ? prev.selectedLabels.filter((id) => id !== labelId)
        : [...prev.selectedLabels, labelId],
    }))
  }

  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return true
    return task.status === filter
  })

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Eshada's Task" width={125} height={100} className="" />
              <h1 className="text-xl font-bold text-foreground">Eshada's Task</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Welcome, {user.email}</span>
              <Button variant="destructive" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full justify-start cursor-pointer" size="sm">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      New Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        placeholder="Task title"
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      />
                      <Textarea
                        placeholder="Task description"
                        value={taskForm.description}
                        onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Select
                            value={taskForm.status}
                            onValueChange={(value) =>
                              setTaskForm({ ...taskForm, status: value as Task["status"] }) 
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={TaskStatus.TODO}>To Do</SelectItem>
                              <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
                              <SelectItem value={TaskStatus.DONE}>Done</SelectItem>
                            </SelectContent>
                        </Select>

                        <Input
                          type="date"
                          value={taskForm.due_date}
                          onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })}
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-sm font-medium">Labels</label>
                        <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                          {labels.map((label) => (
                            <div key={label.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`label-${label.id}`}
                                checked={taskForm.selectedLabels.includes(label.id)}
                                onCheckedChange={() => toggleLabel(label.id)}
                              />
                              <label
                                htmlFor={`label-${label.id}`}
                                className="text-xs cursor-pointer flex items-center gap-1"
                              >
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: `rgb(${label.color})` }}
                                />
                                {label.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Button onClick={handleCreateTask} className="w-full" disabled={!taskForm.title.trim()}>
                        Create Task
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

              </CardContent>
            </Card>

            {/* Filters */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { key: "all", label: "All Tasks", count: tasks.length },
                  { key: "todo", label: "To Do", count: tasks.filter((t) => t.status === "todo").length },
                  {
                    key: "in_progress",
                    label: "In Progress",
                    count: tasks.filter((t) => t.status === "in-progress").length,
                  },
                  { key: "completed", label: "Completed", count: tasks.filter((t) => t.status === "done").length },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setFilter(item.key)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      filter === item.key
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{item.label}</span>
                      <span className="text-xs">{item.count}</span>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Labels */}
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="text-lg">Labels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {labels.map((label) => (
                    <Badge
                      key={label.id}
                      variant="outline"
                      className="text-xs border-border/50"
                      style={{
                        backgroundColor: `${label.color}20`,
                        borderColor: `${label.color}50`,     
                        color: label.color,                  
                      }}
                    >
                      {label.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-foreground">
                  {filter === "all"
                    ? "All Tasks"
                    : filter === "todo"
                      ? "To Do"
                      : filter === "in_progress"
                        ? "In Progress"
                        : "Completed"}
                </h2>
                <div className="text-sm text-muted-foreground font-bold">
                  {filteredTasks.length} Task{filteredTasks.length !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Tasks Grid */}
              <div className="grid gap-4">
                {filteredTasks.map((task) => (
                  <Card key={task.id} className="border-border/50 bg-card/50 hover:bg-card/70 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-card-foreground text-pretty">{task.title}</h3>
                            <Badge className={`text-xs ${getStatusColor(task.status)}`}>
                              {task.status.replace("_", " ")}
                            </Badge>
                          </div>

                          {task.description && (
                            <p className="text-sm text-muted-foreground text-pretty">{task.description}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {task.due_date && (
                              <div className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                Due {new Date(task.due_date).toLocaleDateString()}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                              Created {new Date(task.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          {task.labels.map((label) => (
                            <Badge
                              key={label.id}
                              variant="outline"
                              className="text-xs border mr-2"
                              style={{
                                backgroundColor: `${label.color}33`,
                                borderColor: label.color,
                                color: label.color,
                              }}
                            >
                              {label.name}
                            </Badge>
                          ))}

                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                />
                              </svg>
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { status: "todo" })}>
                              Mark as To Do
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { status: "in-progress" })}>
                              Mark as In Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateTask(task.id, { status: "done" })}>
                              Mark as Done
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              Delete Task
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>                  
                        </div>
                    </CardContent>
                  </Card>
                ))}

                {filteredTasks.length === 0 && (
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="p-12 text-center">
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-muted-foreground"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                          </svg>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-medium text-card-foreground">No tasks found</h3>
                          <p className="text-sm text-muted-foreground">
                            {filter === "all"
                              ? "Get started by creating your first task"
                              : `No ${filter.replace("_", " ")} tasks at the moment`}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
