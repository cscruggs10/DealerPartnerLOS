// NHTSA VIN Decoder API
// https://vpic.nhtsa.dot.gov/api/

export interface VehicleInfo {
  vin: string;
  year: string;
  make: string;
  model: string;
  bodyStyle: string;
  isValid: boolean;
  errorMessage?: string;
}

interface NHTSAResult {
  Variable: string;
  Value: string | null;
}

interface NHTSAResponse {
  Results: NHTSAResult[];
}

export async function decodeVIN(vin: string): Promise<VehicleInfo> {
  const cleanVin = vin.trim().toUpperCase();

  // Basic VIN validation (17 characters for modern vehicles)
  if (cleanVin.length !== 17) {
    return {
      vin: cleanVin,
      year: '',
      make: '',
      model: '',
      bodyStyle: '',
      isValid: false,
      errorMessage: 'VIN must be 17 characters',
    };
  }

  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${cleanVin}?format=json`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from NHTSA API');
    }

    const data: NHTSAResponse = await response.json();
    const results = data.Results;

    // Helper to find a value by variable name
    const getValue = (variableName: string): string => {
      const result = results.find((r) => r.Variable === variableName);
      return result?.Value?.trim() || '';
    };

    // Check for error codes
    const errorCode = getValue('Error Code');
    const errorText = getValue('Error Text');

    // Error codes: 0 = no error, 1 = VIN decoded with possible errors, etc.
    const hasError = errorCode && !['0', '1'].includes(errorCode);

    const year = getValue('Model Year');
    const make = getValue('Make');
    const model = getValue('Model');
    const bodyStyle = getValue('Body Class');

    // If we got key data, consider it valid even with minor errors
    const isValid = !hasError && (year !== '' || make !== '' || model !== '');

    return {
      vin: cleanVin,
      year,
      make,
      model,
      bodyStyle,
      isValid,
      errorMessage: hasError ? errorText : undefined,
    };
  } catch (error) {
    return {
      vin: cleanVin,
      year: '',
      make: '',
      model: '',
      bodyStyle: '',
      isValid: false,
      errorMessage: error instanceof Error ? error.message : 'Failed to decode VIN',
    };
  }
}
