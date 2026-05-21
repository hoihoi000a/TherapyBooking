FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY TherapyBooking.csproj ./
RUN dotnet restore TherapyBooking.csproj

COPY . ./
RUN dotnet publish TherapyBooking.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

COPY --from=build /app/publish ./

ENV ASPNETCORE_ENVIRONMENT=Production

CMD ["sh", "-c", "dotnet TherapyBooking.dll --urls http://0.0.0.0:${PORT:-8080}"]
