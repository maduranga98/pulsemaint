import { useRef, useEffect } from 'react';

interface OTPInputProps {
  length?: number;
  masked?: boolean;
  onComplete: (value: string) => void;
}

export default function OTPInput({ length = 6, masked = false, onComplete }: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [values, setValues] = [null as any, null as any] as any[];

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const paste = e.clipboardData?.getData('text');
      if (paste && /^\d+$/.test(paste)) {
        const pastedDigits = paste.slice(0, length).split('');
        pastedDigits.forEach((digit, index) => {
          if (inputRefs.current[index]) {
            inputRefs.current[index]!.value = digit;
          }
        });

        const fullValue = pastedDigits.slice(0, length).join('');
        if (fullValue.length === length) {
          onComplete(fullValue);
        } else {
          const nextIndex = Math.min(pastedDigits.length, length - 1);
          inputRefs.current[nextIndex]?.focus();
        }

        e.preventDefault();
      }
    };

    const inputs = inputRefs.current;
    inputs.forEach((input) => {
      if (input) {
        input.addEventListener('paste', handlePaste as any);
      }
    });

    return () => {
      inputs.forEach((input) => {
        if (input) {
          input.removeEventListener('paste', handlePaste as any);
        }
      });
    };
  }, [length, onComplete]);

  const handleInput = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const digit = value.slice(-1);

    if (!/^\d*$/.test(digit)) {
      e.target.value = '';
      return;
    }

    if (digit) {
      inputRefs.current[index]!.value = digit;

      const allValues = inputRefs.current.map((ref) => ref?.value || '').join('');

      if (allValues.length === length) {
        onComplete(allValues);
      } else if (index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (inputRefs.current[index]!.value) {
        inputRefs.current[index]!.value = '';
      } else if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type={masked ? 'password' : 'text'}
          inputMode="numeric"
          maxLength={1}
          className="w-12 h-12 text-center text-lg font-semibold border-2 border-gray-300 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
          onInput={(e) => handleInput(index, e as React.ChangeEvent<HTMLInputElement>)}
          onKeyDown={(e) => handleKeyDown(index, e)}
        />
      ))}
    </div>
  );
}
