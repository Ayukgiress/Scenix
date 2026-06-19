import { useDashboardStore } from "@/store/dashboardStore"

class RealtimeService {
  private intervals: NodeJS.Timeout[] = []

  start() {
    // Simulate render progress updates
    const renderInterval = setInterval(() => {
      const { projects, updateProjectProgress, updateProjectStatus, addActivity, incrementStat } = useDashboardStore.getState()
      
      projects.forEach((project) => {
        if (project.status === "rendering" || project.status === "processing") {
          const currentProgress = project.progress ?? 0
          
          if (currentProgress >= 100) {
            updateProjectStatus(project.id, "exported")
            addActivity({
              icon: "export",
              text: `${project.title} export completed`,
              time: "Just now",
            })
            incrementStat("exports")
          } else {
            // Increment by 2-8%
            const increment = Math.floor(Math.random() * 7) + 2
            updateProjectProgress(project.id, Math.min(currentProgress + increment, 100))
          }
        }
      })
    }, 2000)

    // Simulate random activity
    const activityInterval = setInterval(() => {
      const actions = [
        { icon: "edit", text: "Timeline auto-saved" },
        { icon: "ai", text: "AI suggestions generated" },
        { icon: "share", text: "Project shared with team" },
      ]
      const random = actions[Math.floor(Math.random() * actions.length)]
      useDashboardStore.getState().addActivity({ ...random, time: "Just now" })
    }, 15000)

    this.intervals = [renderInterval, activityInterval]
  }

  stop() {
    this.intervals.forEach(clearInterval)
    this.intervals = []
  }
}

export const realtimeService = new RealtimeService()
