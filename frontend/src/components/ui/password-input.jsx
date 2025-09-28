import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EyeIcon, EyeOffIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PasswordInput({ className, ...props }) {
    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <div className="relative">
            <Input
                {...props}
                type={showPassword ? "text" : "password"}
                className={cn("pr-10", className)}
            />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={togglePasswordVisibility}
                disabled={props.disabled}
            >
                {showPassword ? (
                    <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
                ) : (
                    <EyeIcon className="h-4 w-4 text-muted-foreground" />
                )}
            </Button>
        </div>
    );
}