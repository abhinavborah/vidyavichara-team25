import { useTheme } from "@/lib/theme"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
    const { theme, setTheme } = useTheme()

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light')
    }

    const getThemeIcon = () => {
        if (theme === 'light') {
            return '🌙' // Moon for dark mode option
        } else {
            return '☀️' // Sun for light mode option
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-10 w-10 hover:bg-accent/50"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            <span className="text-lg" role="img" aria-hidden="true">
                {getThemeIcon()}
            </span>
        </Button>
    )
}